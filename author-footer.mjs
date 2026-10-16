if (new URLSearchParams(location.search).get('embedded') !== '1') {
  const footer = document.createElement('footer');
  footer.className = 'author-footer';
  footer.innerHTML = `
    <span>Desenvolvido por <a class="author-name" href="https://www.linkedin.com/in/erlaniofreire" target="_blank" rel="noopener noreferrer">Erlânio Freire</a></span>
    <nav aria-label="Perfis de Erlânio Freire">
      <a href="http://lattes.cnpq.br/8383140784249878" target="_blank" rel="noopener noreferrer" aria-label="Currículo Lattes de Erlânio Freire" title="Currículo Lattes">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 6.5v11h7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
      <a href="https://www.linkedin.com/in/erlaniofreire" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn de Erlânio Freire" title="LinkedIn">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.75H4.97V9.2h2.96v9.55ZM6.45 7.9a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.85h-2.96V14.1c0-1.11-.02-2.54-1.55-2.54-1.55 0-1.79 1.21-1.79 2.46v4.73H9.49V9.2h2.84v1.3h.04c.4-.75 1.36-1.55 2.8-1.55 2.99 0 3.58 1.97 3.58 4.53v5.27Z"/></svg>
      </a>
      <a href="https://github.com/erlanio" target="_blank" rel="noopener noreferrer" aria-label="GitHub de Erlânio Freire" title="GitHub">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.61-3.37-1.18-3.37-1.18-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.33 1.08 2.9.83.09-.64.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.55 9.55 0 0 1 12 6.85c.85 0 1.7.11 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.72c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>
      </a>
    </nav>`;
  const studioMain = document.querySelector('.app > .main');
  if (studioMain) studioMain.append(footer);
  else document.querySelector('.app, .uml-app').after(footer);
}
