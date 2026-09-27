import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Element } from '@xmldom/xmldom';
type ChildNode = Element['childNodes'][number];

// Adapted from the gnuplot-markdown-preview sanitizer (ADR 0001): passive SVG only.
const elements = new Set('svg g defs path rect circle ellipse line polyline polygon text tspan title desc use clipPath linearGradient radialGradient stop'.split(' '));
const attributes = new Set('id class x y x1 y1 x2 y2 dx dy cx cy r rx ry width height viewBox preserveAspectRatio d points transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity font-family font-size font-weight font-style text-anchor text-decoration dominant-baseline baseline-shift clip-path gradientUnits gradientTransform offset stop-color stop-opacity xmlns xmlns:xlink href xlink:href'.split(' '));
const svgNamespace = 'http://www.w3.org/2000/svg';
const xlinkNamespace = 'http://www.w3.org/1999/xlink';
const limit = 4_000_000;
/** Graphviz writes gradient stops as `style="stop-color:red;stop-opacity:1.;"` — nothing else. */
const gradientStop = /^(?:\s*stop-(?:color|opacity)\s*:\s*[#\w.%]+\s*;)*\s*$/;

/**
 * Whether a Graphviz link is one the VS Code webview host would open on click. The attribute value
 * is already entity-decoded here, so `&#106;avascript:` is seen as `javascript:` and refused.
 */
function isOpenableLink(a: Element): boolean {
  const href = a.getAttribute('xlink:href') ?? '';
  return /^(?:https?:\/\/|mailto:)[^\s\\"<>]+$/i.test(href);
}

/**
 * Parse Graphviz's `svg_inline` output as XML and rebuild it from passive SVG geometry, text and
 * local references only. Throws on anything that is not a well-formed SVG document.
 */
export function sanitizeSvg(source: string): string {
  if (source.length > limit || /<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Unsafe or oversized SVG output.');
  // `svg_inline` omits the namespace declarations a standalone SVG carries; without them the
  // root would not parse as an SVG element at all.
  const declared = /<svg\b[^>]*\sxmlns=/.test(source)
    ? source
    : source.replace(/<svg\b/, `<svg xmlns="${svgNamespace}" xmlns:xlink="${xlinkNamespace}"`);
  let doc;
  try {
    doc = new DOMParser({ onError: () => { throw new Error(); } }).parseFromString(declared, 'image/svg+xml');
  } catch {
    // The parser's own message quotes the offending markup, which may be author-controlled.
    throw new Error('Graphviz produced SVG that could not be parsed safely.');
  }
  const root = doc.documentElement;
  if (!root || root.tagName !== 'svg' || root.namespaceURI !== svgNamespace) throw new Error('Graphviz did not produce an SVG diagram.');

  function clean(el: Element): void {
    for (const attr of Array.from(el.attributes)) {
      const value = attr.value;
      const localReference = /^#[A-Za-z_][\w:.-]*$/.test(value);
      const localUrl = /^url\(#[A-Za-z_][\w:.-]*\)$/.test(value);
      if (attr.name === 'style' && el.tagName === 'stop' && gradientStop.test(value)) continue;
      if (!attributes.has(attr.name) ||
          ((attr.name === 'href' || attr.name === 'xlink:href') && !localReference) ||
          (/url\s*\(/i.test(value) && !localUrl) ||
          /[\\]|javascript:|data:|https?:|\/\//i.test(value) && !attr.name.startsWith('xmlns')) {
        el.removeAttributeNode(attr);
      }
    }
    cleanChildren(el, Array.from(el.childNodes));
  }
  function cleanChildren(parent: Element, children: ChildNode[]): void {
    for (const child of children) {
      if (child.nodeType !== 1) {
        if (child.nodeType !== 3) parent.removeChild(child);
        continue;
      }
      const element = child as Element;
      if (element.namespaceURI === svgNamespace && element.tagName === 'a' && isOpenableLink(element)) {
        // Keep the link and its tooltip, nothing else: the webview host opens exactly these schemes.
        for (const attr of Array.from(element.attributes)) {
          if (attr.name !== 'xlink:href' && attr.name !== 'xlink:title') element.removeAttributeNode(attr);
        }
        cleanChildren(element, Array.from(element.childNodes));
      } else if (element.namespaceURI === svgNamespace && element.tagName === 'a') {
        // Graphviz wraps any object with a URL or tooltip in <a>. Removing it would remove the
        // node, so its content is hoisted into its place and cleaned like any other.
        const content = Array.from(element.childNodes);
        for (const node of content) parent.insertBefore(node, element);
        parent.removeChild(element);
        cleanChildren(parent, content);
      } else if (element.namespaceURI !== svgNamespace || !elements.has(element.tagName)) {
        parent.removeChild(element);
      } else {
        clean(element);
      }
    }
  }
  clean(root);
  const output = new XMLSerializer().serializeToString(root);
  if (output.length > limit) throw new Error('Unsafe or oversized SVG output.');
  return output;
}

/**
 * Prefix every id and local reference, so several diagrams in one preview — or one cached diagram
 * shown twice — cannot resolve each other's gradients. Graphviz reuses `graph0`, `node1`, `…_l_0`
 * in every diagram. Runs per occurrence, on sanitized output.
 */
export function namespaceSvg(svg: string, prefix: string): string {
  return svg.replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/(\b(?:xlink:)?href=")#/g, `$1#${prefix}`)
    .replace(/url\(#/g, `url(#${prefix}`);
}
