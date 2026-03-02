/**
 * Clona o elemento para o body, injeta a marca d'água (aguarda carregar) e chama window.print()
 */
export async function printElement(el: HTMLElement): Promise<void> {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.id = 'print-clone';

    // Cria a marca d'água como uma imagem real
    const watermark = document.createElement('img');
    watermark.src = '/timbre_semed.png';
    watermark.id = 'print-watermark-img';
    watermark.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60%;
        opacity: 0.05;
        z-index: 9999;
        pointer-events: none;
        display: block !important;
    `;

    clone.style.position = 'relative';
    clone.appendChild(watermark);
    document.body.appendChild(clone);

    // Aguarda a imagem carregar antes de imprimir
    await new Promise((resolve) => {
        if (watermark.complete) {
            resolve(true);
        } else {
            watermark.onload = () => resolve(true);
            watermark.onerror = () => resolve(false);
        }
    });

    window.print();
    document.body.removeChild(clone);
}

/**
 * Busca o primeiro .print-container do DOM e o imprime.
 */
export async function printContainer(): Promise<void> {
    const el = document.querySelector('.print-container') as HTMLElement | null;
    if (el) await printElement(el);
}
