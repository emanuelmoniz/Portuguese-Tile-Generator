var I18N = {
  en: {
    title: 'Portuguese Tile Generator',
    params: 'Tile parameters',
    size: 'Tile size (mm)', sizeHint: '15-200, square',
    colors: 'Colors (base + 1-3 raised)', numColors: 'Number of colors',
    base: 'Base', raised: 'Raised', percent: 'Share (%)',
    coverage: 'Coverage (%)', coverageHint: '30-90, raised area / tile area',
    border: 'Border frame', borderOn: 'On', borderOff: 'Off', borderRandom: 'Random',
    seed: 'Seed', generate: 'Generate', regenerate: 'Regenerate',
    preview: 'Preview', previewEmpty: 'No tile yet. Set the parameters and press Generate.',
    report: 'Report', reportEmpty: 'The coverage and color shares will appear here.',
    saveSvg: 'Save SVG', savePng: 'Save PNG', settings3d: '3D settings...',
    gen3mf: 'Generate 3MF', save3mf: 'Save 3MF', saveBundle: 'Save bundle (.zip)', clear: 'Clear all',
    dlg3d: '3D settings', close: 'Close',
    themeToggle: 'Toggle dark/light', langToggle: 'Language'
  },
  pt: {
    title: 'Gerador de Azulejos Portugueses',
    params: 'Parâmetros do azulejo',
    size: 'Tamanho do azulejo (mm)', sizeHint: '15-200, quadrado',
    colors: 'Cores (base + 1-3 em relevo)', numColors: 'Número de cores',
    base: 'Base', raised: 'Relevo', percent: 'Parte (%)',
    coverage: 'Cobertura (%)', coverageHint: '30-90, área em relevo / área do azulejo',
    border: 'Moldura', borderOn: 'Sim', borderOff: 'Não', borderRandom: 'Aleatória',
    seed: 'Semente', generate: 'Gerar', regenerate: 'Regenerar',
    preview: 'Pré-visualização', previewEmpty: 'Ainda sem azulejo. Defina os parâmetros e carregue em Gerar.',
    report: 'Relatório', reportEmpty: 'A cobertura e a partilha de cores aparecem aqui.',
    saveSvg: 'Guardar SVG', savePng: 'Guardar PNG', settings3d: 'Definições 3D...',
    gen3mf: 'Gerar 3MF', save3mf: 'Guardar 3MF', saveBundle: 'Guardar pacote (.zip)', clear: 'Limpar tudo',
    dlg3d: 'Definições 3D', close: 'Fechar',
    themeToggle: 'Alternar escuro/claro', langToggle: 'Idioma'
  }
};
if (typeof module !== 'undefined') module.exports = I18N;
