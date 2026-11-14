const lang = new URLSearchParams(location.search).get('lang') ?? 'en'
const text = JSON.parse(document.getElementById('text').textContent)[lang]
document.documentElement.lang = lang.replace('_', '-')
for (const element of document.querySelectorAll('[data-t]'))
  element.textContent = text[element.dataset.t]
for (const element of document.querySelectorAll('[data-src]'))
  element.src = element.dataset.src.replace('{lang}', lang)
