# Connect Cell — catálogo com WhatsApp

Loja em PHP 8.1+, HTML, CSS e JavaScript, sem banco de dados e sem dependências de execução. Catálogo persistente em JSON, painel `/admin/`, carrinho no navegador e fechamento pelo WhatsApp. Não há pagamento online, cadastro de comprador, confirmação de pedidos ou desconto automático de estoque.

## Conteúdo inicial

As informações comerciais vêm de `informações` e das seis imagens originais, preservadas na raiz. As versões WebP em `public/assets/` reduzem os cerca de 9 MB originais para aproximadamente 440 KB, sem alterar as características dos produtos.

Os quatro produtos de mobilidade são **demonstrativos**, identificados na vitrine, no detalhe e na mensagem de WhatsApp. Não existem preços ou especificações técnicas confirmados no material recebido: os preços ficam vazios (**Sob consulta**). O telefone `556596437427` foi transcrito do briefing, sem acrescentar dígitos. Confirme o número e a disponibilidade dos produtos antes de divulgar a loja. Não foram inventadas avaliações ou promoções.

Os iPhones 14, 15 e 17 aparecem em destaque, com imagens ilustrativas e preço sob consulta. A atualização inclui os modelos uma única vez em catálogos existentes, respeitando os limites do painel e preservando produtos já cadastrados com o mesmo nome ou identificador. Depois, a loja pode editar, ocultar ou excluir cada modelo pelo painel.

## Requisitos na Hostinger

- Hospedagem PHP compartilhada, Apache ou LiteSpeed com suporte a `.htaccess`; PHP 8.1 ou superior, preferencialmente uma versão ainda suportada pelo provedor.
- Extensões `json`, `session`, `mbstring`, `fileinfo`, `gd` com WebP. `flock`, `rename`, `random_bytes` e `password_hash` disponíveis.
- HTTPS ativo; diretório privado gravável pelo usuário PHP fora de `public_html`; uploads graváveis em `public_html/uploads`.
- `upload_max_filesize = 5M`, `post_max_size = 6M`, `memory_limit = 256M`. O arquivo `.user.ini` contém essas opções; confira os limites efetivos no hPanel.
- Sem Composer, MySQL, processo Node.js, serviços pagos ou tarefas agendadas obrigatórias.

## Instalação na Hostinger (Git ou ZIP)

A raiz do repositório agora pode ser publicada diretamente em `public_html`.
O `index.php` da raiz e o `.htaccess` encaminham vitrine, assets, API e painel
para `public/`. As pastas privadas e configurações são bloqueadas por regras Apache.

1. Configure o deploy Git da branch `main` para `public_html`, ou gere o ZIP com
   `python3 scripts/package.py` e extraia **dentro de `public_html`**.
   Não coloque os arquivos em uma segunda pasta `public_html/public_html`.
2. Preserve o `.htaccess` da raiz e os arquivos `public/.htaccess`,
   `public/.user.ini` e `public/uploads/.htaccess`. Habilite PHP 8.1+ com GD/WebP,
   mbstring e fileinfo e SSL no hPanel. A publicação precisa aceitar regras
   `mod_rewrite` e `Require all denied` (Apache/LiteSpeed).
3. Copie `config.example.php` para `config.local.php` na raiz da instalação.
   Defina uma chave privada de pelo menos 32 caracteres, gerada, por exemplo, com
   `php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'`.
   Mantenha `environment` como `production`.
4. O exemplo usa uma pasta privada ao lado de `public_html`, com nome único
   por instalação. Dê ao usuário PHP permissão para criá-la/gravar nela. Se já
   houver catálogo em `storage/`, preserve esse diretório e mantenha seu
   `data_dir` atual: não crie outro catálogo por cima dos dados reais.
5. Acesse `/admin/`, informe a chave e crie sua senha (mínimo 12 caracteres).
   Depois da instalação, a chave pode ser removida da configuração.
6. Confira WhatsApp, identidade e produtos no painel antes de divulgar.

A estrutura esperada dentro de `public_html` é `index.php`, `.htaccess`,
`config.local.php`, `app/`, `seed/` e `public/`. Não mova individualmente os
arquivos de `public/` nem altere seus caminhos relativos. O ZIP contém somente
código e dados demonstrativos, sem senhas, dados de produção ou uploads.

O formato anterior também continua suportado: `app/` e `seed/` ao lado de
`public_html/`, com o conteúdo de `public/` dentro de `public_html/`. Para esse
formato use os arquivos públicos, não a nova entrada da raiz. Não misture as
duas estruturas numa mesma instalação.

Depois de atualizar, teste `/`, `/admin/`, `/api/index.php?action=catalog` e
as imagens. `/app/bootstrap.php`, `/config.local.php`, `/storage/store.json` e
`/.git/config` devem retornar 403/404, nunca conteúdo privado.

## Uso do painel

- **Produtos:** criar, editar, excluir, ocultar/reativar, destacar, ordenar, marcar disponibilidade manual e demonstração. Ocultar retira o produto da API pública. Indisponíveis permanecem visíveis, mas não podem ser enviados no pedido.
- **Preço:** em reais no painel; armazenado como centavos inteiros no JSON. Campo vazio = sob consulta. Promoção precisa ser inferior ao preço regular. Variações não alteram preço; para preços diferentes, cadastre produtos separados.
- **Imagens:** JPG, PNG ou WebP, até 5 MB, 16 megapixels e 6.000 pixels por lado. O servidor verifica o conteúdo e recodifica em WebP, sem manter código ou metadados embutidos. Há imagem principal e até oito fotos na galeria. Salve o formulário após o upload. Remover uma imagem do produto não apaga o arquivo físico, para preservar backups e referências; arquivos órfãos podem ser revisados por um técnico antes da limpeza.
- **Variações:** uma linha por grupo, por exemplo `Cor: Preto | Branco` e `Tamanho: P | M | G`. Até quatro grupos e vinte opções por grupo.
- **Categorias:** uma por linha. Remova ou mova os produtos antes de excluir sua categoria.
- **Identidade & contato:** logo, imagem do banner, imagem institucional, textos, campanha simples, WhatsApp e links HTTPS de Instagram/Facebook. Os campos são texto e imagens; não executam código.
- **Acesso & backup:** trocar senha e baixar o JSON do catálogo. A troca de senha invalida outras sessões na próxima requisição. Sessões expiram após 30 minutos de inatividade.

Edições são aplicadas na próxima consulta à API, sem novo deploy. Se duas abas editarem a mesma revisão, a segunda gravação é recusada: preserve seu texto, recarregue e reaplique a alteração. O servidor não mescla alterações silenciosamente.

## Carrinho e WhatsApp

O carrinho usa `localStorage` exclusivamente para identificadores, variações e quantidades (1–99 por combinação, até 50 combinações). Os valores exibidos vêm do catálogo; o catálogo é atualizado ao abrir o carrinho. Ao finalizar, a API verifica de novo preço, variações, visibilidade e disponibilidade, e monta a mensagem `wa.me` com os dados atuais.

Itens sem preço exibem “Sob consulta”; o total indica valores conhecidos mais os itens a confirmar. Produtos removidos ou alterados são sinalizados e precisam ser retirados do carrinho. O sistema bloqueia carrinho vazio ou WhatsApp não configurado. Nome e observações são opcionais e não são persistidos no servidor. Pedidos muito longos para o link recebem uma orientação para reduzir itens/observações.

O botão abre o WhatsApp na mesma aba, compatível com celular e desktop, evitando bloqueadores de pop-up. O comprador ainda precisa enviar a mensagem. O envio não confirma compra, preço, entrega ou estoque.

## Estrutura

| Pasta/arquivo | Função |
| --- | --- |
| `public/index.php` | Vitrine pública |
| `public/assets/store.js`, `store.css` | Interface, busca, filtros e detalhes |
| `public/assets/cart.js` | Persistência e resolução do carrinho |
| `public/api/index.php` | API pública e operações autenticadas |
| `public/admin/`, `assets/admin.*` | Login e painel |
| `app/bootstrap.php` | Configuração, sessão, validação e escrita atômica |
| `app/view.php` | Ícones reutilizáveis |
| `seed/demo.json` | Dados iniciais; usados somente quando não há catálogo |
| `storage/` | JSON de produção, hashes, sessões, limites de login e backups; ignorado pelo Git |
| `public/uploads/` | Imagens de administradores; ignoradas pelo Git |
| `config.local.php` | Configuração privada, ignorada pelo Git |
| `scripts/` | Servidor local e empacotamento |
| `tests/` | Testes isolados de API, navegador, carrinho e Apache |

## Desenvolvimento e testes

Para visualizar sem criar credenciais:

```bash
CONNECT_ENV=development php -d upload_max_filesize=5M -d post_max_size=6M -S 127.0.0.1:8080 -t public scripts/router.php
```

Para testar o painel localmente, crie sua própria configuração privada com `environment => development`, a chave de instalação e, de preferência, um `data_dir` de desenvolvimento. Não use `development` na Hostinger. `CONNECT_CONFIG_FILE` e `CONNECT_DATA_DIR` permitem isolar configurações e dados em processos de teste; nunca aponte testes para dados reais.

Node é necessário apenas para os testes e formatação:

```bash
npm ci
npm run test:cart
npm test
npm run test:apache
```

`npm test` requer PHP, Python 3, Playwright e Chromium. Por padrão utiliza `/usr/bin/chromium`; defina `CHROMIUM_PATH` se necessário. Defina `PHP_BIN` para um executável alternativo. O teste cria credenciais aleatórias e arquivos temporários, abre um servidor na porta 8081, executa o fluxo completo e remove somente os uploads criados pelo próprio teste. Capturas de tela ficam em `test-results/`. O teste Apache exige Apache 2, OpenSSL e portas 18080/18443 disponíveis. Pode configurar `HTTPD_BIN` e `HTTPD_MODULE_DIR`.

Validação de sintaxe:

```bash
find app public scripts -name '*.php' -exec php -l '{}' \;
node --check public/assets/store.js
node --check public/assets/admin.js
```

Neste ambiente de nuvem, o PHP foi instalado isoladamente em `/workspace/tools/php/php`. Use `PHP_BIN=/workspace/tools/php/php npm test`. Não há instalação global nem servidor Node necessário.

## Segurança e operação

- Hash de senha com `password_hash` e rehash quando necessário; regeneração de sessão, cookies HttpOnly/SameSite Strict e Secure sob HTTPS.
- CSRF em login, instalação e todas as operações administrativas de escrita. Limite persistente de dez tentativas por IP em quinze minutos, mais limite global de cem; a chave de instalação também está protegida por esse limite.
- CSP restritiva, escape de textos, validação no servidor, mensagens de erro sem caminhos privados, cabeçalhos contra MIME sniffing e incorporação em frames.
- Upload recodificado, nomes aleatórios, extensão WebP e regras para bloquear scripts e listagem. A publicação precisa preservar os dois `.htaccess`.
- Escritas com trava exclusiva em arquivo separado, temporário no mesmo sistema de arquivos, sincronização e substituição atômica. Erros de JSON não recriam nem sobrescrevem o arquivo corrompido.
- Até 1.000 produtos; armazenamento JSON é adequado a catálogos pequenos. A trava é local ao servidor: esta versão não suporta múltiplos servidores gravando simultaneamente ou armazenamento remoto sem garantias de `flock`/`rename`.
- Um administrador por instalação. Para comercializar para clientes diferentes, mantenha uma instalação, configuração, diretório de dados e backup independentes por cliente. Cobrança de assinatura e painel multiempresa não fazem parte do projeto.

## Backup e recuperação

Cada edição salva uma cópia anterior de `store.json` em `storage/backups/`, com retenção das últimas 30 versões. Baixe também o JSON pelo painel. Periodicamente faça uma cópia externa protegida de **todo `storage/`, `config.local.php` e `public_html/uploads/`**. Os arquivos privados contêm hash de senha e configuração: não os publique nem envie ao Git.

Para recuperar, suspenda temporariamente o acesso à aplicação, preserve uma cópia do estado atual, valide o JSON escolhido (`python3 -m json.tool arquivo.json`) e restaure-o como `storage/store.json` por arquivo temporário e renomeação no mesmo diretório. Recupere também as imagens referenciadas. Confira login, catálogo, upload e carrinho antes de reabrir. Para recuperar uma senha perdida, o responsável pelo servidor deve preservar e remover somente `storage/auth.json`, definir uma nova chave privada de instalação e cadastrar outra senha; não apague o catálogo.

## Atualizações e republicações

1. Faça backup privado dos dados, imagens e configuração.
2. Atualize somente o código em `app/`, `seed/` e os arquivos públicos do pacote.
3. **Nunca apague ou substitua** `storage/`, `config.local.php` ou imagens em `uploads/`. Não use `git clean -fdx` ou `rsync --delete` sobre uma instalação em produção.
4. `seed/demo.json` não substitui um catálogo existente. Remover produtos demo pelo painel não os recria em próximas visitas ou deploys.
5. Preserve `.htaccess`, permissões e a versão PHP. Confirme o acesso negado a `/storage/store.json`, `/config.local.php`, `/uploads/.htaccess`, a um arquivo de script de teste em uploads e a listagens de diretório. Não deixe arquivos de teste no servidor.
6. Teste no domínio real: SSL, login, persistência, upload, novo visitante vendo as alterações e link WhatsApp. A validação local não substitui essa conferência após publicação.

Veja `docs/VALIDACAO.md` para o escopo da validação realizada e as limitações.
