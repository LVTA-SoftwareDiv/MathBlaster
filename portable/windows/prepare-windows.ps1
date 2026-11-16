$ErrorActionPreference = 'Stop'
$staging = $null
try {
    $hash = $env:MATHBLASTER_ARCHIVE_HASH
    if ($hash -notmatch '^[a-f0-9]{64}$') { throw 'The launcher has invalid package information.' }
    $arch = $env:MATHBLASTER_ARCH
    if ($arch -notin @('x64','arm64')) { throw 'This computer needs 64-bit Windows 10 or Windows 11.' }
    $parent = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MathBlasterPortable'
    $destination = Join-Path $parent $hash
    $exe = Join-Path $destination 'Math Blaster.exe'
    $marker = Join-Path $destination '.ready'
    $ready = [IO.File]::Exists($exe) -and [IO.File]::Exists($marker) -and ([IO.File]::ReadAllText($marker) -eq $hash)
    if (-not $ready) {
        $archive = Join-Path $env:MATHBLASTER_USB_DIR ('Game Files\Windows-' + $arch + '.zip')
        if (-not [IO.File]::Exists($archive)) { throw 'Keep Play Math Blaster.exe beside the Game Files folder. The game archive could not be found.' }
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $hash) {
            throw 'The game archive is incomplete or damaged. Copy the Windows folder to this USB again.'
        }
        [IO.Directory]::CreateDirectory($parent) | Out-Null
        $staging = Join-Path $parent ('preparing-' + [Guid]::NewGuid().ToString('N'))
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::ExtractToDirectory($archive, $staging)
        if (-not [IO.File]::Exists((Join-Path $staging 'Math Blaster.exe'))) { throw 'The extracted game is missing its executable.' }
        [IO.File]::WriteAllText((Join-Path $staging '.ready'), $hash)
        if ([IO.Directory]::Exists($destination)) { [IO.Directory]::Delete($destination, $true) }
        [IO.Directory]::Move($staging, $destination)
        $staging = $null
    }
    Start-Process -FilePath $exe -WorkingDirectory $destination -ErrorAction Stop
    exit 0
} catch {
    [IO.File]::WriteAllText($env:MATHBLASTER_ERROR_LOG, $_.Exception.Message, [Text.Encoding]::UTF8)
    exit 1
} finally {
    if ($staging -and [IO.Directory]::Exists($staging)) { [IO.Directory]::Delete($staging, $true) }
}
