# CalculaDutos 💨

O **CalculaDutos** é uma aplicação web moderna e eficiente desenvolvida para auxiliar engenheiros, projetistas e técnicos no dimensionamento de dutos de ar condicionado e ventilação. O sistema permite cálculos precisos baseados em velocidade, dimensões ou perda de carga, suportando diversos formatos de dutos.

## 🚀 Funcionalidades

- **Múltiplos Modos de Cálculo**:
  - **Fixar Velocidade**: Determina as dimensões necessárias com base na vazão e vedocidade máxima permitida.
  - **Fixar Dimensões**: Calcula a velocidade e perda de carga para um tamanho de duto específico.
  - **Fixar Pressão**: Estima o diâmetro/tamanho equivalente para uma perda de carga alvo (Pa/m).
- **Suporte a Diversos Formatos**:
  - Retangular
  - Quadrado
  - Circular
  - Oval
- **Gestão de Trechos**:
  - Cálculo sequencial de trechos com dedução automática de vazão.
  - Adição de múltiplas saídas/derivações (Difusores, Grelhas) por trecho.
- **Recomendações Técnicas**:
  - Consulta rápida de faixas de perda de carga recomendadas para diferentes aplicações (Estúdios, Escritórios, Indústria, etc.).
- **Relatórios**:
  - Exportação de relatório completo em **Excel (.xlsx)** contendo todos os dados dos trechos e saídas calculadas.
- **Interface Moderna**:
  - Tema escuro com gradiente azul.
  - Interface responsiva e intuitiva.

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3**: Estrutura semântica e estilização moderna com CSS Variables e Flexbox/Grid.
- **JavaScript (ES6+)**: Lógica de cálculo, manipulação do DOM e gestão de estado.
- **SheetJS (xlsx)**: Biblioteca para geração e download de arquivos Excel diretamente no navegador.
- **Google Fonts**: Tipografia com a fonte 'Inter'.

## 📦 Como Usar

1. **Clone ou Baixe** este repositório.
2. Navegue até a pasta do projeto.
3. Abra o arquivo `index.html` em seu navegador de preferência.
    - *Nota: Para que a exportação do Excel funcione corretamente, é necessário estar conectado à internet para carregar a biblioteca SheetJS via CDN.*

## 📐 Fórmulas e Referências

O sistema utiliza aproximações padrão da indústria para cálculos de:

- **Diâmetro Hidráulico/Equivalente** ($D_e$) para dutos não circulares.
- **Perda de Carga** ($\Delta P$) baseada em equações de atrito para ar padrão em dutos de aço galvanizado.

---
*Desenvolvido com foco em produtividade e precisão.*
