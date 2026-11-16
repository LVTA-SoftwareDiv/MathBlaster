#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <wchar.h>
#include "build_info.h"
#include "prepare_script.h"

static HANDLE child = NULL;
static BOOL cancelled = FALSE;
static HWND statusWindow = NULL;
static LRESULT CALLBACK windowProc(HWND hwnd, UINT message, WPARAM w, LPARAM l) {
    if (message == WM_CLOSE) {
        cancelled = TRUE;
        if (child) TerminateProcess(child, 1);
        DestroyWindow(hwnd);
        return 0;
    }
    return DefWindowProcW(hwnd, message, w, l);
}
static int error(const wchar_t *message) {
    MessageBoxW(NULL, message, L"Math Blaster could not open", MB_OK | MB_ICONERROR);
    return 1;
}
int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, PWSTR args, int show) {
    (void)previous; (void)args; (void)show;
    HANDLE mutex = CreateMutexW(NULL, TRUE, L"Local\\MathBlasterPortableLauncher");
    if (!mutex) return error(L"Could not start the launcher.");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        HWND other = FindWindowW(L"MathBlasterPortableLauncher", NULL);
        if (other) SetForegroundWindow(other);
        CloseHandle(mutex); return 0;
    }
    const wchar_t *arch = NULL, *hash = NULL;
    USHORT processMachine = 0, nativeMachine = 0;
    typedef BOOL (WINAPI *ArchitectureFn)(HANDLE, USHORT*, USHORT*);
    ArchitectureFn getArchitecture = (ArchitectureFn)(void*)GetProcAddress(GetModuleHandleW(L"kernel32.dll"), "IsWow64Process2");
    if (getArchitecture && getArchitecture(GetCurrentProcess(), &processMachine, &nativeMachine)) {
        if (nativeMachine == IMAGE_FILE_MACHINE_ARM64) arch = L"arm64";
        if (nativeMachine == IMAGE_FILE_MACHINE_AMD64) arch = L"x64";
    } else {
        SYSTEM_INFO info; GetNativeSystemInfo(&info);
        if (info.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_ARM64) arch = L"arm64";
        if (info.wProcessorArchitecture == PROCESSOR_ARCHITECTURE_AMD64) arch = L"x64";
    }
    if (!arch) return error(L"Math Blaster needs 64-bit Windows 10 or Windows 11.");
    hash = wcscmp(arch, L"arm64") == 0 ? HASH_ARM64 : HASH_X64;
    wchar_t folder[32768], powershell[32768], temporary[MAX_PATH], log[MAX_PATH];
    DWORD length = GetModuleFileNameW(NULL, folder, 32768);
    if (!length || length >= 32768) return error(L"The launcher path is too long.");
    wchar_t *slash = wcsrchr(folder, L'\\');
    if (!slash) return error(L"The launcher folder could not be found.");
    *slash = 0;
    if (!GetWindowsDirectoryW(powershell, 32000)) return error(L"Windows could not be located.");
    wcscat(powershell, L"\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    if (!GetTempPathW(MAX_PATH, temporary) || !GetTempFileNameW(temporary, L"MBL", 0, log)) return error(L"The temporary folder is not writable.");
    if (!SetEnvironmentVariableW(L"MATHBLASTER_USB_DIR", folder) ||
        !SetEnvironmentVariableW(L"MATHBLASTER_ARCH", arch) ||
        !SetEnvironmentVariableW(L"MATHBLASTER_ARCHIVE_HASH", hash) ||
        !SetEnvironmentVariableW(L"MATHBLASTER_ERROR_LOG", log)) return error(L"The game could not be prepared.");
    WNDCLASSW wc = {0}; wc.lpfnWndProc = windowProc; wc.hInstance = instance;
    wc.lpszClassName = L"MathBlasterPortableLauncher"; wc.hbrBackground = (HBRUSH)(COLOR_WINDOW + 1);
    wc.hCursor = LoadCursorW(NULL, IDC_ARROW); wc.hIcon = LoadIconW(instance, MAKEINTRESOURCEW(1));
    RegisterClassW(&wc);
    int x = (GetSystemMetrics(SM_CXSCREEN)-460)/2, y = (GetSystemMetrics(SM_CYSCREEN)-150)/2;
    statusWindow = CreateWindowExW(0, wc.lpszClassName, L"Math Blaster", WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
                                  x, y, 460, 150, NULL, NULL, instance, NULL);
    CreateWindowW(L"STATIC", L"Preparing Math Blaster...\nThe first launch takes a little longer.",
                  WS_CHILD | WS_VISIBLE, 24, 24, 400, 70, statusWindow, NULL, instance, NULL);
    ShowWindow(statusWindow, SW_SHOWNORMAL); UpdateWindow(statusWindow);
    wchar_t command[32768];
    _snwprintf(command, 32768, L"\"%ls\" -NoLogo -NoProfile -NonInteractive -EncodedCommand %ls", powershell, PREPARE_SCRIPT);
    command[32767] = 0;
    STARTUPINFOW startup = {0}; startup.cb = sizeof(startup);
    PROCESS_INFORMATION process = {0};
    if (!CreateProcessW(powershell, command, NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, folder, &startup, &process)) {
        DestroyWindow(statusWindow); DeleteFileW(log);
        return error(L"Windows PowerShell could not start. This launcher needs the PowerShell included with Windows 10 or 11.");
    }
    child = process.hProcess; CloseHandle(process.hThread);
    while (WaitForSingleObject(child, 0) == WAIT_TIMEOUT) {
        MsgWaitForMultipleObjects(1, &child, FALSE, 250, QS_ALLINPUT);
        MSG message;
        while (PeekMessageW(&message, NULL, 0, 0, PM_REMOVE)) { TranslateMessage(&message); DispatchMessageW(&message); }
    }
    DWORD result = 1; GetExitCodeProcess(child, &result); CloseHandle(child); child = NULL;
    if (IsWindow(statusWindow)) DestroyWindow(statusWindow);
    if (result != 0 && !cancelled) {
        char contents[8192] = {0}; DWORD read = 0;
        HANDLE f = CreateFileW(log, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
        if (f != INVALID_HANDLE_VALUE) { ReadFile(f, contents, sizeof(contents)-1, &read, NULL); CloseHandle(f); }
        wchar_t message[8192];
        if (read && MultiByteToWideChar(CP_UTF8, 0, contents, -1, message, 8192)) error(message);
        else error(L"The game could not be prepared. Check that Game Files is beside the launcher and that this computer has enough free disk space.");
    }
    DeleteFileW(log); ReleaseMutex(mutex); CloseHandle(mutex);
    return cancelled ? 0 : (int)result;
}
