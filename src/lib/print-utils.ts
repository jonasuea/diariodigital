/**
 * Clona o elemento para o body, injeta a marca d'água (aguarda carregar) e chama window.print()
 */
export async function printElement(el: HTMLElement): Promise<void> {
    // Remove any previous clone
    const oldClone = document.getElementById('print-clone');
    if (oldClone) oldClone.remove();

    // Deep clone the element
    const clone = el.cloneNode(true) as HTMLElement;
    clone.id = 'print-clone';

    // IMPORTANT: Force the clone to be visible and have layout, even if the original is hidden or in a portal
    clone.style.setProperty('display', 'block', 'important');
    clone.style.setProperty('visibility', 'visible', 'important');
    clone.style.setProperty('opacity', '1', 'important');
    clone.style.setProperty('position', 'relative', 'important');
    clone.style.setProperty('width', '100%', 'important');
    clone.style.setProperty('height', 'auto', 'important');

    // Create the watermark
    const watermark = document.createElement('img');
    watermark.src = '/timbre_semed.png';
    watermark.id = 'print-watermark-img';

    // Most styles moved to index.css to avoid overrides, 
    // but we keep z-index here just in case.
    watermark.style.zIndex = '-1';

    // Append as first child so it's behind other content
    clone.insertBefore(watermark, clone.firstChild);
    document.body.appendChild(clone);

    // Wait for watermark
    await new Promise((resolve) => {
        if (watermark.complete) {
            resolve(true);
        } else {
            watermark.onload = () => resolve(true);
            watermark.onerror = () => resolve(false);
        }
    });

    // Increased render delay for complex layouts (charts, etc.)
    await new Promise(r => setTimeout(r, 500));

    window.print();

    // Safe cleanup
    setTimeout(() => {
        const c = document.getElementById('print-clone');
        if (c) c.remove();
    }, 1000);
}

/**
 * Busca o primeiro .print-container do DOM e o imprime.
 */
export async function printContainer(): Promise<void> {
    const el = document.querySelector('.print-container') as HTMLElement | null;
    if (el) await printElement(el);
}
