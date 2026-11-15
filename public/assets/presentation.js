// Update the original visual defaults in existing installations without rewriting
// private JSON or replacing content customized by the administrator.
const originalDefaults = {
  heroTitle: "Seu próximo movimento começa aqui.",
  heroText:
    "Explore nossa seleção de mobilidade elétrica. Escolha o seu estilo e converse com quem entende.",
  heroImage: "/assets/scooter-branca.webp",
  about:
    "Da assistência técnica ao seu próximo acessório: a Connect Cell conecta você à tecnologia em Comodoro. Conheça também nossos serviços de gravação a laser e impressão 3D.",
};
const currentDefaults = {
  heroTitle: "Sua próxima conexão está aqui.",
  heroText: "",
  heroImage: "/assets/loja.webp",
  about: "Tecnologia, acessórios e assistência técnica. Perto de você.",
};
export function presentationSettings(settings) {
  const result = { ...settings };
  for (const key of Object.keys(currentDefaults)) {
    if (result[key] === originalDefaults[key])
      result[key] = currentDefaults[key];
  }
  return result;
}
