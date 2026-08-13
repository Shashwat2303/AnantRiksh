/**
 * Optical Spectrum Inspector Modal
 */
import { fetchSpectrumFromAPI } from '../cosmologyClient.js';

export class SpectrumModal {
  constructor() {
    this.modal = document.getElementById('spectrum-modal');
    this.closeBtn = document.getElementById('btn-close-spectrum');
    this.bindEvents();
  }

  bindEvents() {
    this.closeBtn.addEventListener('click', () => this.hide());
    this.modal.addEventListener('click', e => {
      if (e.target === this.modal) this.hide();
    });
  }

  show() {
    this.modal.classList.remove('hidden');
  }

  hide() {
    this.modal.classList.add('hidden');
  }

  async inspectObject(objectId) {
    try {
      this.show();
      const spec = await fetchSpectrumFromAPI(objectId);

      document.getElementById('spec-target-name').textContent = `SDSS J${(objectId * 137 % 89999 + 10000)} • OBJ #${objectId}`;
      const tag = document.getElementById('spec-type-tag');
      tag.textContent = spec.is_qso ? 'QUASAR (QSO)' : 'GALAXY';
      tag.className = `badge-tag ${spec.is_qso ? 'qso' : ''}`;

      document.getElementById('spec-z').textContent = `z = ${spec.redshift.toFixed(4)}`;
      document.getElementById('spec-class').textContent = spec.spectral_class;
      document.getElementById('spec-temp').textContent = `${spec.temperature_k.toLocaleString()} K`;
      document.getElementById('spec-mag').textContent = `${spec.apparent_mag_r.toFixed(2)} mag`;

      this.renderSpectrumSVG(spec.wavelengths_nm, spec.flux_densities, spec.emission_lines);
      this.renderLineTags(spec.emission_lines);
    } catch (err) {
      console.error("Spectrum inspection error:", err);
    }
  }

  renderSpectrumSVG(wavelengths, fluxes, emissionLines) {
    const svg = document.getElementById('spectrum-svg');
    const width = 600;
    const height = 180;
    const padding = 25;

    const minWl = Math.min(...wavelengths);
    const maxWl = Math.max(...wavelengths);
    const maxFlux = Math.max(...fluxes) * 1.15 || 100;

    let pathD = '';
    wavelengths.forEach((wl, i) => {
      const x = padding + ((wl - minWl) / (maxWl - minWl)) * (width - padding * 2);
      const y = (height - padding) - (fluxes[i] / maxFlux) * (height - padding * 2);
      pathD += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });

    let svgHTML = `
      <defs>
        <linearGradient id="specGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="35%" stop-color="#00f0ff" />
          <stop offset="65%" stop-color="#ffaa33" />
          <stop offset="100%" stop-color="#ff2a6d" />
        </linearGradient>
      </defs>
      <!-- Background Grid -->
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#223355" stroke-width="1" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#223355" stroke-width="1" />
      
      <!-- Flux Line -->
      <path d="${pathD}" fill="none" stroke="url(#specGrad)" stroke-width="2.5" />
    `;

    // Emission line markers
    emissionLines.forEach(line => {
      if (line.observed_wavelength_nm >= minWl && line.observed_wavelength_nm <= maxWl) {
        const lx = padding + ((line.observed_wavelength_nm - minWl) / (maxWl - minWl)) * (width - padding * 2);
        svgHTML += `
          <line x1="${lx}" y1="${padding}" x2="${lx}" y2="${height - padding}" stroke="#ffaa33" stroke-width="1" stroke-dasharray="3 3" />
          <text x="${lx + 3}" y="${padding + 12}" fill="#ffaa33" font-size="9" font-family="'JetBrains Mono'">${line.name}</text>
        `;
      }
    });

    svgHTML += `
      <text x="${padding}" y="${height - 8}" fill="#8899b8" font-size="9" font-family="'JetBrains Mono'">${Math.round(minWl)} nm</text>
      <text x="${width - padding - 45}" y="${height - 8}" fill="#8899b8" font-size="9" font-family="'JetBrains Mono'">${Math.round(maxWl)} nm</text>
    `;

    svg.innerHTML = svgHTML;
  }

  renderLineTags(lines) {
    const container = document.getElementById('spec-lines-container');
    container.innerHTML = lines.map(l => `
      <span class="line-tag">${l.name} • Obs: ${l.observed_wavelength_nm} nm</span>
    `).join('');
  }
}
