<?php require __DIR__.'/../app/bootstrap.php'; require ROOT.'/app/view.php'; header('Cache-Control: no-cache'); ?>
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="Conheça a Connect Cell em Comodoro: tecnologia, acessórios, mobilidade e assistência técnica. Monte sua seleção e fale com a loja pelo WhatsApp."><meta name="theme-color" content="#ffffff"><title>Connect Cell — Tecnologia que conecta</title><link rel="icon" href="/assets/logo.webp"><link rel="stylesheet" href="<?=assetUrl('store.css')?>"><script type="module" src="<?=assetUrl('store.js')?>"></script></head>
<body>
<a class="skip" href="#catalogo">Ir para o catálogo</a>
<header class="header wrap"><a href="/" class="brand" aria-label="Página inicial"><img data-logo src="/assets/logo.webp" alt="Logo Connect Cell" width="48" height="48"><span><strong data-store-name>Connect Cell</strong></span></a><nav aria-label="Navegação principal"><a href="#catalogo">Catálogo</a><a href="#servicos">Serviços</a><a href="#sobre">A Connect</a></nav></header>
<main>
<section class="showroom wrap" aria-labelledby="hero-title">
  <div class="showroom-intro">
    <p class="showroom-kicker">Tecnologia e mobilidade</p>
    <h1 id="hero-title">Sua próxima conexão está aqui.</h1>
    <p id="hero-text" hidden></p>
    <div class="showroom-links">
      <a class="button" href="#catalogo">Ver produtos <?=icon('arrow')?></a>
      <a class="contact-link" data-contact href="#contato">Falar com a loja <?=icon('chat')?></a>
    </div>
  </div>
  <div id="showroom-media" class="showroom-media" hidden></div>
</section>
<div class="catalog-band">
<section class="catalog wrap" id="catalogo" aria-labelledby="catalog-title"><div class="section-heading"><div><h2 id="catalog-title">Explore o catálogo.</h2></div></div><p id="campaign" class="campaign" hidden></p><div class="catalog-tools"><div class="filters" id="filters" aria-label="Categorias"></div><label class="search"><?=icon('search')?><input id="search" type="search" placeholder="Buscar produto" aria-label="Pesquisar produtos"></label></div><div class="catalog-meta"><p id="results" aria-live="polite">Carregando catálogo…</p><label>Ordenar <select id="sort" aria-label="Ordenar produtos"><option value="featured">Destaques</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome A–Z</option></select></label></div><div id="products" class="product-grid"></div><p class="demo-note" id="demo-note" hidden>Produtos demonstrativos. Consulte valores e disponibilidade.</p></section>
</div>
<section id="servicos" class="services wrap"><div class="section-heading"><h2>Serviços da Connect.</h2></div><div class="service-grid"><a class="service" data-contact href="#contato"><?=icon('tool')?><h3>Assistência técnica</h3><b>Solicitar reparo <?=icon('arrow')?></b></a><a class="service" data-contact href="#contato"><?=icon('bolt')?><h3>Gravação a laser</h3><b>Personalizar <?=icon('arrow')?></b></a><a class="service" data-contact href="#contato"><?=icon('cube')?><h3>Impressão 3D</h3><b>Pedir orçamento <?=icon('arrow')?></b></a></div></section>
<section id="sobre" class="about wrap"><div class="about-image"><img id="about-image" src="/assets/loja.webp" alt="Fachada da Connect Cell e produtos em exposição" loading="lazy" width="1025" height="1025"></div><div class="about-copy"><h2>Sua Connect.<br>Aqui em Comodoro.</h2><p id="about-text"></p><a class="text-link" id="instagram" href="https://www.instagram.com/connectcell_cdo/" target="_blank" rel="noopener noreferrer">Ver Instagram <?=icon('arrow')?></a></div></section>
<section id="contato" class="contact wrap"><div><h2>Fale com a gente.</h2><a class="button light" data-contact href="#contato">Abrir WhatsApp <?=icon('chat')?></a></div><div class="contact-details"><div><span>VISITE A LOJA</span><p id="address"></p><a id="map-link" class="text-link" target="_blank" rel="noopener noreferrer">Como chegar <?=icon('arrow')?></a></div><div><span>HORÁRIO DE ATENDIMENTO</span><p id="hours"></p><a id="phone"></a></div></div></section>
</main><footer class="wrap"><a href="/" class="footer-name" data-store-name>Connect Cell</a><a id="facebook" hidden target="_blank" rel="noopener noreferrer">Facebook</a><span>COMODORO / MT</span></footer>
<button class="cart-trigger floating-cart" id="open-cart" aria-label="Abrir carrinho"><?=icon('bag')?><span>Carrinho</span><b id="cart-count">0</b></button>
<dialog id="product-dialog" class="product-dialog" aria-labelledby="product-title"><button class="close" data-close aria-label="Fechar detalhes"><?=icon('close')?></button><div id="product-detail"></div></dialog>
<dialog id="cart-dialog" class="cart-dialog" aria-labelledby="cart-title"><div class="drawer-head"><div><h2 id="cart-title">Carrinho</h2></div><button class="close" data-close aria-label="Fechar carrinho"><?=icon('close')?></button></div><div id="cart-items"></div><div id="cart-bottom"><div class="cart-total"><span>Total estimado</span><strong id="cart-total"></strong></div><p class="fineprint">Valores e disponibilidade serão confirmados pela equipe. O envio da mensagem não confirma a compra.</p><label>Seu nome <small>(opcional)</small><input id="customer-name" autocomplete="name" maxlength="100" placeholder="Como podemos chamar você?"></label><label>Observações <small>(opcional)</small><textarea id="customer-notes" maxlength="1000" rows="2" placeholder="Algo que precisamos saber?"></textarea></label><p id="checkout-error" class="error" role="alert"></p><button id="checkout" class="button">Finalizar pedido <?=icon('chat')?></button></div></dialog>
<div id="toast" class="toast" role="status"></div><noscript><p class="wrap error">Ative o JavaScript para carregar o catálogo e usar o carrinho.</p></noscript>
</body></html>
