# Trial Sequential Analysis (TSA) Tool

Interactive web application for Trial Sequential Analysis - a statistical method for cumulative meta-analysis monitoring boundaries and futility analysis in clinical trials.

## Features

- 📊 **Interactive TSA Visualization**: Real-time rendering of Z-curves with O'Brien-Fleming boundaries
- 📈 **Multiple Datasets**: Pre-loaded clinical trial datasets for demonstration
- 🎨 **Modern UI**: Dark theme with responsive design
- 📱 **Fully Responsive**: Works on desktop, tablet, and mobile
- ♿ **Accessible**: WCAG compliant with proper ARIA labels
- 🚀 **Production Ready**: Zero build errors, optimized bundle

## Live Demo

[Add your deployment URL here]

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Visualization**: HTML5 Canvas
- **Statistics**: Custom TypeScript implementation

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/tsa-tool.git
cd tsa-tool

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5173` to see the app.

### Build for Production

```bash
npm run build
```

The optimized build will be in the `dist/` directory.

## Statistical Methods

The application implements:

- **Mantel-Haenszel** pooled odds ratio calculation
- **O'Brien-Fleming** alpha-spending boundaries
- **DerSimonian-Laird** heterogeneity estimation (I², τ², Q-statistic)
- **Normal quantile** function (inverse CDF)
- **Chi-squared** distribution for p-values

## Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Netlify

```bash
npm run build
# Drag /dist folder to netlify.com/drop
```

### GitHub Pages

1. Update `vite.config.ts` with your repo name:
   ```ts
   export default defineConfig({
     base: '/tsa-tool/',
     // ...
   })
   ```
2. Build and deploy:
   ```bash
   npm run build
   git add dist -f
   git commit -m "Deploy"
   git subtree push --prefix dist origin gh-pages
   ```

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── TSAChart.tsx       # Canvas-based chart component
│   │   └── ErrorBoundary.tsx  # Error handling wrapper
│   ├── lib/
│   │   └── statistics.ts      # Statistical calculations
│   ├── data.ts                # Example datasets
│   ├── types.ts               # TypeScript interfaces
│   ├── App.tsx                # Main application
│   └── main.tsx               # Entry point
├── public/
│   └── favicon.svg            # Custom favicon
└── index.html                 # HTML template
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Statistical methods based on Copenhagen Trial Unit methodology
- Inspired by TSA software for meta-analysis
