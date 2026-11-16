import Cocoa
import CryptoKit

final class PortableLauncher: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 440, height: 125), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.title = "Math Blaster"
        let label = NSTextField(wrappingLabelWithString: "Preparing Math Blaster…\nThe first launch takes a little longer.")
        label.frame = NSRect(x: 28, y: 48, width: 390, height: 52)
        window.contentView?.addSubview(label)
        let spinner = NSProgressIndicator(frame: NSRect(x: 28, y: 21, width: 380, height: 16))
        spinner.style = .bar; spinner.isIndeterminate = true; spinner.startAnimation(nil)
        window.contentView?.addSubview(spinner)
        window.center(); window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let game = try self.prepare()
                DispatchQueue.main.async {
                    let config = NSWorkspace.OpenConfiguration()
                    config.activates = true
                    NSWorkspace.shared.openApplication(at: game, configuration: config) { _, error in
                        DispatchQueue.main.async {
                            if let error = error { self.showError(error) }
                            else { NSApp.terminate(nil) }
                        }
                    }
                }
            } catch { DispatchQueue.main.async { self.showError(error) } }
        }
    }
    func showError(_ error: Error) {
        let alert = NSAlert()
        alert.messageText = "Math Blaster could not open"
        alert.informativeText = error.localizedDescription
        alert.runModal(); NSApp.terminate(nil)
    }
    func failure(_ message: String) -> NSError {
        NSError(domain: "MathBlasterPortable", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
    func run(_ program: String, _ arguments: [String]) throws {
        let process = Process(); process.executableURL = URL(fileURLWithPath: program); process.arguments = arguments
        let pipe = Pipe(); process.standardError = pipe
        try process.run()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        if process.terminationStatus != 0 {
            throw failure(String(data: data, encoding: .utf8) ?? "The game files could not be prepared. Check the Game Files folder and available disk space.")
        }
    }
    func prepare() throws -> URL {
        let fm = FileManager.default
        let caches = try fm.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let parent = caches.appendingPathComponent("MathBlasterPortable", isDirectory: true)
        let destination = parent.appendingPathComponent(archiveSHA256, isDirectory: true)
        let game = destination.appendingPathComponent("Math Blaster.app", isDirectory: true)
        let marker = destination.appendingPathComponent(".ready")
        if (try? String(contentsOf: marker, encoding: .utf8)) == archiveSHA256,
           fm.isExecutableFile(atPath: game.appendingPathComponent("Contents/MacOS/MathBlaster").path) { return game }
        let archive = Bundle.main.bundleURL.deletingLastPathComponent().appendingPathComponent("Game Files/Mac.zip")
        guard fm.fileExists(atPath: archive.path) else { throw failure("Keep Play Math Blaster beside the Game Files folder. The Mac game archive could not be found.") }
        let data = try Data(contentsOf: archive, options: .mappedIfSafe)
        let actual = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        guard actual == archiveSHA256 else { throw failure("The Mac game archive is incomplete or damaged. Copy the Mac folder to this USB again.") }
        try fm.createDirectory(at: parent, withIntermediateDirectories: true)
        let staging = parent.appendingPathComponent("preparing-" + UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: staging) }
        try run("/usr/bin/ditto", ["-x", "-k", archive.path, staging.path])
        let stagedGame = staging.appendingPathComponent("Math Blaster.app", isDirectory: true)
        guard fm.isExecutableFile(atPath: stagedGame.appendingPathComponent("Contents/MacOS/MathBlaster").path) else { throw failure("The extracted game is missing its executable.") }
        try run("/usr/bin/codesign", ["--verify", "--deep", "--strict", stagedGame.path])
        try archiveSHA256.write(to: staging.appendingPathComponent(".ready"), atomically: true, encoding: .utf8)
        if fm.fileExists(atPath: destination.path) {
            if (try? String(contentsOf: marker, encoding: .utf8)) == archiveSHA256 { return game }
            try fm.removeItem(at: destination)
        }
        try fm.moveItem(at: staging, to: destination)
        return game
    }
}
let app = NSApplication.shared
let delegate = PortableLauncher()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
