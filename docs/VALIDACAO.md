# Validação — 15/11/2026

Executada localmente com PHP 8.4.24, Chromium/Playwright 1.62.1, Python 3.12 e Apache 2.4.68. Produção continua sem dependências Node. A compatibilidade sintática foi desenvolvida para PHP 8.1+, mas a execução desta validação foi em PHP 8.4.

## Resultado

**96 verificações aprovadas; nenhuma pendente ou pulada nessas suítes.**

- **53 verificações de integração da API:** catálogo, instalação com chave privada, hash de senha, cookie de sessão, CSRF, login/logout, limite de tentativas, troca de senha, acesso não autorizado, rotas privadas, criação/edição/exclusão/ocultação, categorias, validação de preço e imagem, conflito de revisão, indisponibilidade, variações obrigatórias, cálculo de preço no servidor, WhatsApp ausente/configurado, caracteres especiais, uploads válidos/inválidos/grandes, exportação, backups JSON válidos, persistência após reinício, recusa de JSON corrompido e bloqueio de HTTP em produção.
- **31 verificações em navegador:** login administrativo, upload e prévia da imagem e galeria, cadastro, edição e remoção de imagem da galeria, ocultação/reativação, campanha, backup, catálogo dinâmico, busca/filtro e estados vazios, link individual, escape de HTML, seleção de variações, quantidades, total promocional, persistência do carrinho, remoção, mensagem e destino WhatsApp, navegação e ausência de rolagem horizontal em desktop/tablet/mobile, movimento reduzido, painel mobile, exclusão, logout e ausência de erros JavaScript.
- **3 testes unitários de carrinho:** descarte de preço adulterado no armazenamento, normalização/mesclagem de variações, limites de quantidade e resolução de itens alterados ou removidos.
- **9 verificações em Apache real:** configuração aceita (`Syntax OK`), bloqueio de JSON, scripts `.php` e `.PHP` em uploads, `.htaccess`, listagem de diretórios, inacessibilidade de dados/configuração privados, acesso a WebP e redirecionamento HTTP → HTTPS. O certificado TLS temporário do teste foi confiado explicitamente, sem desativar verificação.

PHP e JavaScript passaram nas verificações de sintaxe. Os testes usam armazenamento e credenciais aleatórios e temporários. Nenhuma credencial de produção foi criada. O link de WhatsApp foi interceptado pelo navegador de testes; nenhuma mensagem foi enviada.

## Revisão visual

Capturas inspecionadas da loja em **1440 × 1000**, **820 × 1180** e **390 × 844**, além do painel administrativo em celular. Conferidos enquadramento, cards, filtros, seções institucionais e navegação. Os arquivos locais de evidência ficam em `test-results/` (ignorados pelo Git). As capturas da vitrine inicial também foram revisadas antes dos testes com produtos temporários.

## Limites da validação

- A loja **não foi publicada nem validada em uma conta Hostinger real**. Os módulos, permissões, SSL e limites PHP do plano contratado precisam ser conferidos após implantação, seguindo o README.
- O Apache local testou as regras distribuídas de `.htaccess` com arquivos de teste isolados. O PHP foi executado no servidor embutido; não foi testada a combinação específica LiteSpeed/PHP do provedor.
- As resoluções mobile/tablet foram emuladas no Chromium. Safari, Firefox, aparelhos físicos e o aplicativo nativo do WhatsApp não foram executados.
- Não houve envio de mensagens nem confirmação de que o número informado no briefing recebe WhatsApp. O responsável deve confirmar o número no painel.
- Não houve teste de carga ou auditoria de segurança externa. Não se afirma segurança absoluta.
- Fotografias e nomes fornecidos não confirmam modelo técnico, preço ou estoque. Os dados iniciais continuam explicitamente demonstrativos e sem preços inventados.
