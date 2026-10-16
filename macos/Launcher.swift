import AppKit
import Foundation

private let localURL = URL(string: "http://127.0.0.1:4173/")!

final class StudioDelegate: NSObject, NSApplicationDelegate {
    private var server: Process?
    private var statusItem: NSStatusItem?
    private var stopping = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let openItem = NSMenuItem(title: "Abrir ARQON Software Engineering Studio", action: #selector(openStudio), keyEquivalent: "o")
        openItem.target = self
        menu.addItem(openItem)
        menu.addItem(NSMenuItem.separator())
        let quitItem = NSMenuItem(title: "Encerrar", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem?.button?.title = "▦ ARQON"
        statusItem?.menu = menu

        guard let resources = Bundle.main.resourceURL else {
            showError("Os arquivos do aplicativo não foram encontrados.")
            return
        }
        let script = resources.appendingPathComponent("web/brmodelo.py")
        guard FileManager.default.fileExists(atPath: script.path) else {
            showError("O servidor Python do aplicativo não foi encontrado.")
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        process.arguments = [script.path, "--no-browser"]
        process.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self = self, !self.stopping else { return }
                self.showError("O servidor local foi encerrado (código \(process.terminationStatus)). Verifique se a porta 4173 está livre.")
            }
        }
        do {
            try process.run()
            server = process
            waitForServer(attempt: 0)
        } catch {
            showError("Não foi possível iniciar o Python 3 local: \(error.localizedDescription)")
        }
    }

    private func waitForServer(attempt: Int) {
        guard attempt < 30, server?.isRunning == true else { return }
        var request = URLRequest(url: localURL)
        request.timeoutInterval = 1
        URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
            let valid = (response as? HTTPURLResponse)?.statusCode == 200 &&
                data.flatMap { String(data: $0, encoding: .utf8) }?.contains("<title>ARQON Software Engineering Studio</title>") == true
            DispatchQueue.main.async {
                guard let self = self, !self.stopping else { return }
                if valid {
                    NSWorkspace.shared.open(localURL)
                } else if self.server?.isRunning == true {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                        self.waitForServer(attempt: attempt + 1)
                    }
                }
            }
        }.resume()
    }

    private func showError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "ARQON Software Engineering Studio"
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.runModal()
        quit()
    }

    @objc private func openStudio() {
        NSWorkspace.shared.open(localURL)
    }

    @objc private func quit() {
        stopping = true
        if server?.isRunning == true { server?.terminate() }
        NSApp.terminate(nil)
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopping = true
        if server?.isRunning == true { server?.terminate() }
    }
}

let app = NSApplication.shared
let delegate = StudioDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
