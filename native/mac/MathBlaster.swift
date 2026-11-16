import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var quitting = false
    var terminationReplied = false
    var quitTimeout: DispatchWorkItem?
    var frameTimer: Timer?
    var frameInFlight = false
    func applicationDidFinishLaunching(_ notification: Notification) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "printCertificate")
        config.userContentController.addUserScript(WKUserScript(source: "window.print = function(){window.webkit.messageHandlers.printCertificate.postMessage('print');};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        if #available(macOS 12.3, *) { config.preferences.isElementFullscreenEnabled = true }
        webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground")
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1000, height: 840), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        // Swift owns this window. NSWindow's default release-on-close would
        // over-release it while the asynchronous save/quit is still pending.
        window.isReleasedWhenClosed = false
        window.title = "Math Blaster: In Search of Spot"
        window.minSize = NSSize(width: 660, height: 610)
        window.contentView = webView
        window.delegate = self
        window.center()
        window.setFrameAutosaveName("MathBlasterWindow")
        if let html = Bundle.main.url(forResource: "Play Math Blaster", withExtension: "html") {
            webView.loadFileURL(html, allowingReadAccessTo: html.deletingLastPathComponent())
        }
        let menu = NSMenu()
        let appItem = NSMenuItem(); menu.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "About Math Blaster", action: #selector(showAbout), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Math Blaster", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(); menu.addItem(editItem);let editMenu = NSMenu(title: "Edit");editItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        let viewItem = NSMenuItem();menu.addItem(viewItem);let viewMenu=NSMenu(title:"View");viewItem.submenu=viewMenu
        let full = NSMenuItem(title: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f");full.keyEquivalentModifierMask=[.command,.control];viewMenu.addItem(full)
        NSApplication.shared.mainMenu = menu
        // Drive canvas frames from the native window clock. This avoids WebKit's
        // timer/animation throttling when a file-backed page is first presented.
        let timer = Timer(timeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
            guard let self = self, !self.quitting, self.window.isVisible, self.window.isKeyWindow,
                  !self.frameInFlight else { return }
            self.frameInFlight = true
            self.webView.evaluateJavaScript("window.MathBlasterNativeFrame?.(Date.now())") { _, _ in
                self.frameInFlight = false
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        frameTimer = timer
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
    @objc func showAbout() {
        let alert = NSAlert()
        alert.messageText = "Math Blaster: In Search of Spot"
        alert.informativeText = "Local recreation using the original Davidson & Associates artwork and audio. Original game © 1993–1994 Davidson & Associates. All four activities run locally without an emulator."
        alert.runModal()
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "printCertificate", !quitting else { return }
        let info = NSPrintInfo.shared.copy() as! NSPrintInfo
        info.horizontalPagination = .fit
        info.verticalPagination = .fit
        info.isHorizontallyCentered = true
        let operation = webView.printOperation(with: info)
        operation.runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
    }
    func stopFrameTimer() {
        frameTimer?.invalidate()
        frameTimer = nil
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        // Keep the window and WebKit alive until the game has saved. AppKit
        // closes the window itself after the termination reply below.
        if !quitting { NSApplication.shared.terminate(nil) }
        return false
    }
    func windowWillClose(_ notification: Notification) {
        stopFrameTimer()
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if terminationReplied { return .terminateNow }
        if quitting { return .terminateLater }
        quitting = true
        stopFrameTimer()
        let timeout = DispatchWorkItem { [weak self] in self?.finishTermination(sender) }
        quitTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 5, execute: timeout)
        webView.evaluateJavaScript("window.dispatchEvent(new Event('beforeunload'))") { [weak self] _, _ in
            self?.finishTermination(sender)
        }
        return .terminateLater
    }
    func finishTermination(_ sender: NSApplication) {
        guard quitting, !terminationReplied else { return }
        terminationReplied = true
        quitTimeout?.cancel()
        quitTimeout = nil
        sender.reply(toApplicationShouldTerminate: true)
    }
    func applicationWillTerminate(_ notification: Notification) {
        stopFrameTimer()
        quitTimeout?.cancel()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "printCertificate")
    }
}
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
