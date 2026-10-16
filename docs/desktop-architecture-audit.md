# Auditoria anterior à integração desktop

Esta auditoria registra o estado do brModelo Studio antes da camada Tauri. Ela foi feita por leitura do código, sem execução de um aplicativo Tauri.

## Entrada e recursos

- `index.html` é a entrada principal. `script.js` implementa o espaço de trabalho, com `styles.css`, modelos `.mjs` e `document-store.mjs` carregados por caminhos relativos.
- `uml-activity/`, `uml-class/` e `uml-sequence/` têm páginas, scripts e estilos próprios. O editor principal abre essas páginas em `iframe` com parâmetros `projectId`, `diagramId`, `embedded` e `theme`.
- Os módulos de modelagem são JavaScript nativo. Não há framework frontend, compilação de assets ou APIs HTTP de backend.
- Os únicos endereços externos no código da interface são links de perfil no rodapé, abertos por escolha do usuário. A fonte remota foi removida; não há recurso obrigatório obtido da internet.

## Servidor e origem

- `brmodelo.py` usa `SimpleHTTPRequestHandler` para servir arquivos estáticos do diretório do projeto em `127.0.0.1:4173`. Não oferece rotas de aplicação nem transformação de conteúdo. A porta fixa preserva a origem dos dados do navegador entre execuções.
- O aplicativo macOS existente (`macos/Launcher.swift` e `build_macos_app.py`) inicia esse servidor Python, verifica a página inicial e a abre no navegador. Esse fluxo permanece independente da integração Tauri.
- A navegação usa caminhos relativos, parâmetros de URL, `location.origin` e `postMessage` entre a página principal e os `iframe`. O diálogo entre os editores exige que pai e filho tenham a mesma origem. Uma origem estável de assets Tauri pode atender a essa regra, mas precisa de verificação real nos WebViews de cada sistema.
- A origem Tauri será diferente de `http://127.0.0.1:4173`. `localStorage` e IndexedDB do navegador não serão automaticamente visíveis nela. A migração deve ser explícita por exportação/importação, sem apagar dados antigos.

## Armazenamento e formatos

- `script.js` usa `brmodelo-studio-v1`, `brmodelo-studio-projects-v1`, `brmodelo-studio-open-documents-v1`, `brmodelo-studio-active-tab-v1` e chaves de tema/layout no `localStorage`.
- Cada editor UML mantém projetos e rascunhos sob chaves `brmodelo.uml-activity.*`, `brmodelo.uml-class.*` e `brmodelo.uml-sequence.*`; atividades também guarda até 30 versões manuais no `localStorage`.
- `document-store.mjs` abre IndexedDB `brmodelo-studio.documents`, versão 1, store `documents` com chave `id` e índices `kind`, `projectId`, `updatedAt`. Escrita e exclusão usam transações `readwrite` que esperam `oncomplete`; leituras usam transações `readonly`.
- Documentos confirmados têm `{id, kind, version, projectId, name, updatedAt, content}`. O tipo `studio-diagram` salva metadados do projeto e um diagrama; tipos `uml-activity`, `uml-class` e `uml-sequence` salvam o projeto UML e o ID do diagrama.
- A exportação tem formatos distintos: projeto principal JSON simples, documento ativo embrulhado com `format: brmodelo-studio-document`, e documentos UML com wrappers próprios. `openImportedDocument` já importa esses wrappers e documentos confirmados; o importador mais antigo `importFile` aceita apenas projeto principal simples e atividades. A camada desktop deve reutilizar `openImportedDocument`, validar cada formato pelo dono do modelo e preservar a serialização original.

## Ações e interações existentes

- O menu Arquivo do editor principal oferece salvar em IndexedDB, salvar como cópia, exportar JSON, abrir documento salvo, fechar e fechar todos. Há confirmação de alterações pendentes ao fechar documentos e `beforeunload` para saída da página.
- Exportações adicionais incluem CSV, SQL, SVG, PNG, PDF por impressão e subconjuntos PlantUML/Mermaid, dependendo do editor. Downloads no navegador usam `Blob` e URL de objeto.
- Arrastar elementos internos já usa `drag`/`drop`; soltar um arquivo do sistema precisa ser distinguido de arrastar um elemento do canvas.
- Os atalhos do editor principal e dos editores UML incluem salvar, salvar como, fechar documento, desfazer/refazer e movimentação do canvas. Menus nativos devem encaminhar ações aos mesmos controladores, sem implementar regras UML paralelas.

## Testes e limites de verificação

- Testes Node estão em `tests/` e `uml-*/tests/`; cobrem modelos, validação, armazenamento e rotas sem iniciar o WebView.
- O checkout atual é macOS arm64. `cargo` e `rustc` não estão disponíveis, e não há máquinas Windows/Linux acessíveis nesta sessão. Builds e validação real nesses sistemas precisam de runners e evidências próprias.
- A integração inicial deve manter Python/Swift e o navegador funcionando. Até validar WebView, IndexedDB, arquivos nativos, importação e todos os editores em sistemas reais, não há evidência para declarar os critérios de aceite concluídos.

## Decisão de implementação

- O shell Tauri fica em `desktop/`, sem alterar a composição dos modelos. `desktop-bridge.mjs` detecta o runtime; a versão web continua sem comandos nativos.
- Os recursos estáticos são copiados pelo script de preparação para `desktop/web-dist/` e embutidos no aplicativo. Nenhum processo Python é iniciado pelo Tauri.
- Os comandos Rust são proprietários do seletor, leitura e gravação de arquivos, histórico de caminhos e encerramento. O JavaScript existente continua proprietário da validação e da importação de cada formato.
- O workflow de CI fica dentro de `brmodelo-modern` para acompanhar a futura raiz do projeto; por estar aninhado neste checkout, não é executado pelo repositório `rea`.
