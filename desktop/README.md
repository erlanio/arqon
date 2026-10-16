# brModelo Studio Desktop (Tauri 2)

O shell desktop empacota os mesmos HTML, CSS e módulos JavaScript usados pela versão web. Python e Node.js são necessários somente para os fluxos de desenvolvimento/build; o usuário final executa o aplicativo empacotado. O lançador macOS em Python/Swift continua disponível.

## Desenvolver e compilar

Requer Node.js 20+, Rust estável, Python 3 com Pillow e as dependências de sistema do Tauri 2. No Linux, instale WebKitGTK 4.1, AppIndicator/Ayatana, `libxdo`, OpenSSL, librsvg e as ferramentas de compilação. Windows requer o toolchain MSVC e WebView2; o instalador usa o modo offline de WebView2. Consulte os [pré-requisitos do Tauri](https://v2.tauri.app/start/prerequisites/).

```sh
python -m pip install Pillow==11.3.0
npm install
npm run dev
npm run build
```

Execute os comandos em `desktop/`. O build cria `src-tauri/target/release/bundle/` com MSI/NSIS no Windows, DEB/AppImage no Linux e o pacote macOS no respectivo runner. Ícones, assets empacotados e binários são gerados localmente e ignorados pelo Git. A configuração usa uma origem interna estável do Tauri e carrega somente recursos locais; nenhum servidor Python é iniciado.

## Arquivos e recuperação

- **Arquivo → Abrir arquivo…** abre um JSON existente. **Salvar** grava no mesmo arquivo após a primeira escolha; **Salvar como…** solicita outro caminho. **Projetos recentes…** reabre arquivos usados anteriormente.
- O formato JSON existente é mantido. Projetos do editor principal usam o projeto simples; os editores UML usam seus wrappers de exportação. A importação cria nova identidade no espaço de trabalho para não sobrescrever uma cópia já armazenada.
- A gravação cria arquivo temporário no mesmo diretório, sincroniza os dados e substitui o destino. Quando há um arquivo anterior, conserva `nome.json.bak` antes da substituição. Em caso de arquivo corrompido, abra o `.bak` após copiar/renomear para `.json`.
- `localStorage` e IndexedDB continuam sendo usados para sessões e documentos locais. Dados do navegador antigo não aparecem automaticamente no WebView: exporte o JSON na versão web, depois use **Arquivo → Abrir arquivo…** ou **Importar JSON** no desktop. Não há migração ou exclusão automática.
- Arquivos JSON acima de 5 MB são recusados. Se o seletor for cancelado, nenhum arquivo é escrito. Os caminhos recentes ficam em `recent-projects.json` no diretório de configuração da aplicação.

## Validação e distribuição

O workflow em `.github/workflows/desktop.yml` deste projeto testa os modelos e prepara builds Windows x64, Linux x64 e macOS arm64. Tags `v*` criam releases em rascunho com os pacotes, para revisão antes da publicação. Assinatura e atualizações automáticas ainda não estão configuradas.

Esta integração é experimental até executar o aplicativo e testar IndexedDB, todos os editores, importação/exportação, arrastar arquivos, fechamento e operação offline em Windows e Linux reais. O workflow está ativo no repositório independente [`erlanio/brmodelo-studio`](https://github.com/erlanio/brmodelo-studio).

### Build local verificado em 16/10/2026

Em macOS arm64, `npm run build` gerou o aplicativo e o DMG. O primeiro DMG não tinha uma assinatura válida do bundle e podia falhar ao abrir depois do download. A configuração agora solicita assinatura ad hoc ao próprio Tauri. O novo `.app` e o `.app` dentro do DMG passaram em `codesign --verify --deep --strict`; o DMG passou em `hdiutil verify`. As cópias atualizadas estão em `dist/brModelo Studio Tauri.app` e `dist/brModelo-Studio-Tauri-macOS-arm64.dmg`. O binário abriu em execução direta, mas a interface e os fluxos dos editores não foram validados visualmente neste ambiente. A assinatura ad hoc não equivale à assinatura Developer ID nem à notarização da Apple; o macOS pode pedir autorização em **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim** após a primeira tentativa de abertura.

### Builds de CI em 16/10/2026

O [workflow do commit `e7184ec`](https://github.com/erlanio/brmodelo-studio/actions/runs/38953941797) concluiu os três jobs com sucesso e publicou artefatos para macOS arm64, Windows x86_64 e Linux x86_64. O workflow está configurado para coletar MSI/NSIS no Windows e DEB/AppImage no Linux; a lista de arquivos dentro de cada ZIP ainda não foi inspecionada nesta sessão. Para baixá-los, abra a seção **Artifacts** da execução no GitHub Actions e extraia o ZIP correspondente.

Esses resultados comprovam compilação e empacotamento nos runners. Instalação, abertura de arquivos, persistência, compatibilidade dos editores e uso offline ainda precisam de verificação manual em Windows e Linux.
