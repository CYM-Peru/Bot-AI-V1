export interface HtmlToImageOptions {
  backgroundColor?: string;
  cacheBust?: boolean;
  filter?: (node: HTMLElement) => boolean;
  height?: number;
  style?: Partial<CSSStyleDeclaration>;
  width?: number;
  quality?: number;
  pixelRatio?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  skipAutoScale?: boolean;
}

interface Dimensions {
  width: number;
  height: number;
}

function resolveDimensions(node: HTMLElement, options: HtmlToImageOptions): Dimensions {
  if (options.width && options.height) {
    return { width: options.width, height: options.height };
  }

  const rect = node.getBoundingClientRect();
  const computedWidth = options.width ?? rect.width ?? node.offsetWidth ?? node.scrollWidth;
  const computedHeight = options.height ?? rect.height ?? node.offsetHeight ?? node.scrollHeight;

  return {
    width: Math.max(1, Math.round(computedWidth)),
    height: Math.max(1, Math.round(computedHeight)),
  };
}

function copyStyle(source: Element, target: Element) {
  const sourceStyle = window.getComputedStyle(source);

  if (sourceStyle.cssText) {
    (target as HTMLElement).style.cssText = sourceStyle.cssText;
  } else {
    for (let i = 0; i < sourceStyle.length; i += 1) {
      const property = sourceStyle.item(i);
      if (!property) continue;
      const value = sourceStyle.getPropertyValue(property);
      const priority = sourceStyle.getPropertyPriority(property);
      (target as HTMLElement).style.setProperty(property, value, priority);
    }
  }
}

function cloneNodeDeep(node: Node, filter?: (node: HTMLElement) => boolean): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.cloneNode(true);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return node.cloneNode(true);
  }

  const element = node as unknown as HTMLElement;

  if (filter && !filter(element)) {
    return null;
  }

  const clone = element.cloneNode(false) as HTMLElement;
  copyStyle(element, clone);

  element.childNodes.forEach((child) => {
    const clonedChild = cloneNodeDeep(child, filter);
    if (clonedChild) {
      clone.appendChild(clonedChild);
    }
  });

  if (clone instanceof HTMLCanvasElement && element instanceof HTMLCanvasElement) {
    const context = element.getContext('2d');
    if (context) {
      const dataURL = element.toDataURL();
      const image = new Image();
      image.src = dataURL;
      image.onload = () => {
        const targetContext = clone.getContext('2d');
        targetContext?.drawImage(image, 0, 0);
      };
    }
  }

  if (clone instanceof HTMLImageElement && element instanceof HTMLImageElement) {
    clone.src = element.currentSrc || element.src;
  }

  return clone;
}

function applyCustomStyle(node: HTMLElement, options: HtmlToImageOptions) {
  if (!options.style) return;

  Object.entries(options.style).forEach(([key, value]) => {
    if (value == null) return;
    node.style.setProperty(key, String(value));
  });
}

function nodeToSvgDataUrl(node: HTMLElement, options: HtmlToImageOptions, dimensions: Dimensions): string {
  const clonedNode = cloneNodeDeep(node, options.filter);
  if (!(clonedNode instanceof HTMLElement)) {
    throw new Error('No se pudo clonar el nodo proporcionado.');
  }
  const cloned = clonedNode;
  cloned.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  applyCustomStyle(cloned, options);

  const { width, height } = dimensions;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', width.toString());
  svg.setAttribute('height', height.toString());
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('x', '0');
  foreignObject.setAttribute('y', '0');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');
  foreignObject.appendChild(cloned);

  if (options.backgroundColor) {
    svg.style.backgroundColor = options.backgroundColor;
  }

  svg.appendChild(foreignObject);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = (event) => reject(event);
    image.src = url;
  });
}

async function svgToCanvas(
  svgUrl: string,
  dimensions: Dimensions,
  options: HtmlToImageOptions
): Promise<HTMLCanvasElement> {
  const image = await loadImage(svgUrl);
  const canvas = document.createElement('canvas');
  const pixelRatio = options.pixelRatio ?? window.devicePixelRatio ?? 1;
  const width = options.canvasWidth ?? dimensions.width;
  const height = options.canvasHeight ?? dimensions.height;

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo obtener el contexto 2D del canvas.');
  }

  if (!options.skipAutoScale && pixelRatio !== 1) {
    context.scale(pixelRatio, pixelRatio);
  }

  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

export async function toSvg(node: HTMLElement, options: HtmlToImageOptions = {}): Promise<string> {
  const dimensions = resolveDimensions(node, options);
  return nodeToSvgDataUrl(node, options, dimensions);
}

export async function toCanvas(node: HTMLElement, options: HtmlToImageOptions = {}): Promise<HTMLCanvasElement> {
  const dimensions = resolveDimensions(node, options);
  const svgUrl = await toSvg(node, options);
  return svgToCanvas(svgUrl, dimensions, options);
}

export async function toPng(node: HTMLElement, options: HtmlToImageOptions = {}): Promise<string> {
  const canvas = await toCanvas(node, options);
  return canvas.toDataURL('image/png');
}

export async function toJpeg(node: HTMLElement, options: HtmlToImageOptions = {}): Promise<string> {
  const canvas = await toCanvas(node, options);
  const quality = typeof options.quality === 'number' ? options.quality : 0.92;
  return canvas.toDataURL('image/jpeg', quality);
}

export async function toBlob(node: HTMLElement, options: HtmlToImageOptions = {}): Promise<Blob | null> {
  const canvas = await toCanvas(node, options);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export async function toPixelData(node: HTMLElement, options: HtmlToImageOptions = {}): Promise<Uint8ClampedArray> {
  const canvas = await toCanvas(node, options);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo obtener el contexto 2D del canvas.');
  }
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height);
  return imageData.data;
}
