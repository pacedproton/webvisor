/**
 * Virtual DOM implementation for WebVisor
 * Provides complete DOM virtualization with event handling
 */

import type {
  VirtualDOM,
  VirtualElement,
  VirtualText,
  VirtualNode,
  VirtualDocument,
  SerializedDOM,
  SerializedNode,
} from './types.js';
import { getLogger } from '../../utils/instrumentation/logger.js';
import { getMetrics } from '../../utils/instrumentation/metrics.js';
import { getTracer } from '../../utils/instrumentation/tracer.js';

const logger = getLogger('virtual-dom');
const metrics = getMetrics();
const tracer = getTracer();

/**
 * Generate unique node ID
 */
let nextNodeId = 1;
function generateNodeId(): string {
  return `vnode-${nextNodeId++}`;
}

/**
 * Virtual Element implementation
 */
export class VirtualElementImpl implements VirtualElement {
  readonly id: string;
  readonly tagName: string;
  readonly attributes: Map<string, string>;
  readonly children: VirtualNode[];
  readonly eventListeners: Map<string, EventListener[]>;
  parent: VirtualElementImpl | null = null;

  constructor(tagName: string) {
    this.id = generateNodeId();
    this.tagName = tagName.toLowerCase();
    this.attributes = new Map();
    this.children = [];
    this.eventListeners = new Map();

    metrics.counter('vdom.elements_created').inc();
  }

  setAttribute(name: string, value: string): void {
    const oldValue = this.attributes.get(name);
    this.attributes.set(name, value);

    logger.trace('Attribute set', {
      operation: 'setAttribute',
      element: this.tagName,
      id: this.id,
      attribute: name,
      value,
      oldValue,
    });

    metrics.counter('vdom.attributes_set').inc();
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    logger.trace('Attribute removed', {
      operation: 'removeAttribute',
      element: this.tagName,
      attribute: name,
    });
  }

  appendChild(child: VirtualNode): void {
    return tracer.trace('vdom.appendChild', (span) => {
      span.setAttribute('parent', this.tagName);
      span.setAttribute('childType', isVirtualText(child) ? 'text' : 'element');

      // Remove from old parent
      if (isVirtualElement(child) && child.parent) {
        child.parent.removeChild(child);
      }

      this.children.push(child);

      if (isVirtualElement(child)) {
        child.parent = this;
      }

      logger.trace('Child appended', {
        operation: 'appendChild',
        parent: this.tagName,
        parentId: this.id,
        childId: isVirtualElement(child) ? child.id : 'text',
      });

      metrics.counter('vdom.children_appended').inc();
    }) as void;
  }

  removeChild(child: VirtualNode): void {
    const index = this.children.indexOf(child);
    if (index === -1) {
      throw new Error('Node not found in children');
    }

    this.children.splice(index, 1);

    if (isVirtualElement(child)) {
      child.parent = null;
    }

    logger.trace('Child removed', {
      operation: 'removeChild',
      parent: this.tagName,
      childIndex: index,
    });

    metrics.counter('vdom.children_removed').inc();
  }

  insertBefore(newChild: VirtualNode, refChild: VirtualNode | null): void {
    if (!refChild) {
      this.appendChild(newChild);
      return;
    }

    const index = this.children.indexOf(refChild);
    if (index === -1) {
      throw new Error('Reference node not found');
    }

    // Remove from old parent
    if (isVirtualElement(newChild) && newChild.parent) {
      newChild.parent.removeChild(newChild);
    }

    this.children.splice(index, 0, newChild);

    if (isVirtualElement(newChild)) {
      newChild.parent = this;
    }

    logger.trace('Child inserted', {
      operation: 'insertBefore',
      parent: this.tagName,
      index,
    });
  }

  replaceChild(newChild: VirtualNode, oldChild: VirtualNode): void {
    const index = this.children.indexOf(oldChild);
    if (index === -1) {
      throw new Error('Old child not found');
    }

    this.children[index] = newChild;

    if (isVirtualElement(oldChild)) {
      oldChild.parent = null;
    }

    if (isVirtualElement(newChild)) {
      newChild.parent = this;
    }

    logger.trace('Child replaced', {
      operation: 'replaceChild',
      parent: this.tagName,
      index,
    });
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }

    this.eventListeners.get(type)!.push(listener);

    logger.trace('Event listener added', {
      operation: 'addEventListener',
      element: this.tagName,
      eventType: type,
    });

    metrics.counter('vdom.event_listeners_added').inc();
  }

  removeEventListener(type: string, listener: EventListener): void {
    const listeners = this.eventListeners.get(type);
    if (!listeners) return;

    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);

      logger.trace('Event listener removed', {
        operation: 'removeEventListener',
        element: this.tagName,
        eventType: type,
      });
    }
  }

  dispatchEvent(event: Event): boolean {
    const listeners = this.eventListeners.get(event.type);
    if (!listeners) return true;

    for (const listener of listeners) {
      try {
        if (typeof listener === 'function') {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      } catch (error) {
        logger.error('Event listener error', error, {
          operation: 'dispatchEvent',
          eventType: event.type,
        });
      }
    }

    return !event.defaultPrevented;
  }

  querySelector(selector: string): VirtualElement | null {
    // Simple implementation - only supports tag names and IDs for now
    if (selector.startsWith('#')) {
      const id = selector.substring(1);
      return this.findById(id);
    }

    if (selector.match(/^[a-z0-9]+$/i)) {
      return this.findByTagName(selector);
    }

    logger.warn('Complex selectors not yet supported', {
      operation: 'querySelector',
      selector,
    });

    return null;
  }

  querySelectorAll(selector: string): VirtualElement[] {
    const results: VirtualElement[] = [];

    if (selector.startsWith('#')) {
      const el = this.querySelector(selector);
      if (el) results.push(el);
      return results;
    }

    if (selector.match(/^[a-z0-9]+$/i)) {
      this.findAllByTagName(selector, results);
      return results;
    }

    return results;
  }

  private findById(id: string): VirtualElement | null {
    if (this.id === id) return this;

    for (const child of this.children) {
      if (isVirtualElement(child)) {
        const found = child.findById(id);
        if (found) return found;
      }
    }

    return null;
  }

  private findByTagName(tagName: string): VirtualElement | null {
    const lower = tagName.toLowerCase();
    if (this.tagName === lower) return this;

    for (const child of this.children) {
      if (isVirtualElement(child)) {
        const found = child.findByTagName(tagName);
        if (found) return found;
      }
    }

    return null;
  }

  private findAllByTagName(tagName: string, results: VirtualElement[]): void {
    const lower = tagName.toLowerCase();
    if (this.tagName === lower) {
      results.push(this);
    }

    for (const child of this.children) {
      if (isVirtualElement(child)) {
        child.findAllByTagName(tagName, results);
      }
    }
  }

  get textContent(): string {
    let text = '';

    for (const child of this.children) {
      if (isVirtualText(child)) {
        text += child.data;
      } else if (isVirtualElement(child)) {
        text += child.textContent;
      }
    }

    return text;
  }

  set textContent(value: string) {
    this.children.length = 0;
    if (value) {
      this.children.push(new VirtualTextImpl(value));
    }
  }

  get innerHTML(): string {
    return this.children
      .map((child) => {
        if (isVirtualText(child)) {
          return escapeHtml(child.data);
        } else {
          return child.outerHTML;
        }
      })
      .join('');
  }

  get outerHTML(): string {
    let html = `<${this.tagName}`;

    for (const [name, value] of this.attributes) {
      html += ` ${name}="${escapeHtml(value)}"`;
    }

    html += '>';
    html += this.innerHTML;
    html += `</${this.tagName}>`;

    return html;
  }

  clone(deep: boolean = false): VirtualElement {
    const clone = new VirtualElementImpl(this.tagName);

    // Copy attributes
    for (const [name, value] of this.attributes) {
      clone.setAttribute(name, value);
    }

    // Deep clone children
    if (deep) {
      for (const child of this.children) {
        if (isVirtualElement(child)) {
          clone.appendChild(child.clone(true));
        } else {
          clone.appendChild(new VirtualTextImpl(child.data));
        }
      }
    }

    return clone;
  }
}

/**
 * Virtual Text node implementation
 */
export class VirtualTextImpl implements VirtualText {
  readonly id: string;
  data: string;

  constructor(data: string) {
    this.id = generateNodeId();
    this.data = data;

    metrics.counter('vdom.text_nodes_created').inc();
  }
}

/**
 * Virtual Document implementation
 */
export class VirtualDocumentImpl extends VirtualElementImpl implements VirtualDocument {
  readonly body: VirtualElementImpl;
  readonly head: VirtualElementImpl;

  constructor() {
    super('#document');

    this.head = new VirtualElementImpl('head');
    this.body = new VirtualElementImpl('body');

    // Add to document
    super.appendChild(this.head);
    super.appendChild(this.body);

    logger.info('Virtual document created', {
      operation: 'constructor',
    });
  }

  createElement(tagName: string): VirtualElement {
    return new VirtualElementImpl(tagName);
  }

  createTextNode(data: string): VirtualText {
    return new VirtualTextImpl(data);
  }
}

/**
 * Virtual DOM implementation
 */
export class VirtualDOMImpl implements VirtualDOM {
  private document: VirtualDocumentImpl;

  // Metrics
  private createElementTimer = metrics.timer('vdom.create_element_time');
  private querySelectorTimer = metrics.timer('vdom.query_selector_time');

  constructor() {
    this.document = new VirtualDocumentImpl();

    logger.info('Virtual DOM initialized', {
      operation: 'constructor',
    });
  }

  createElement(tagName: string): VirtualElement {
    return this.createElementTimer.time(() => {
      return new VirtualElementImpl(tagName);
    }) as VirtualElement;
  }

  createTextNode(data: string): VirtualText {
    return new VirtualTextImpl(data);
  }

  querySelector(selector: string): VirtualElement | null {
    return this.querySelectorTimer.time(() => {
      return this.document.querySelector(selector);
    }) as VirtualElement | null;
  }

  querySelectorAll(selector: string): VirtualElement[] {
    return this.querySelectorTimer.time(() => {
      return this.document.querySelectorAll(selector);
    }) as VirtualElement[];
  }

  getDocument(): VirtualDocument {
    return this.document;
  }

  serialize(): SerializedDOM {
    return tracer.trace('vdom.serialize', (span) => {
      const nodes: SerializedNode[] = [];
      this.serializeNode(this.document, nodes);

      span.setAttribute('nodeCount', nodes.length);

      logger.info('DOM serialized', {
        operation: 'serialize',
        nodeCount: nodes.length,
      });

      return {
        nodes,
        rootId: this.document.id,
      };
    }) as SerializedDOM;
  }

  private serializeNode(node: VirtualNode, nodes: SerializedNode[]): void {
    if (isVirtualText(node)) {
      nodes.push({
        id: node.id,
        type: 'text',
        data: node.data,
      });
    } else {
      const serialized: SerializedNode = {
        id: node.id,
        type: 'element',
        tagName: node.tagName,
        attributes: Object.fromEntries(node.attributes),
        children: node.children.map((child) =>
          isVirtualElement(child) ? child.id : child.id
        ),
      };

      nodes.push(serialized);

      // Recursively serialize children
      for (const child of node.children) {
        this.serializeNode(child, nodes);
      }
    }
  }

  deserialize(data: SerializedDOM): void {
    return tracer.trace('vdom.deserialize', (span) => {
      const nodeMap = new Map<string, VirtualNode>();

      // First pass: create all nodes
      for (const serialized of data.nodes) {
        if (serialized.type === 'text') {
          nodeMap.set(serialized.id, new VirtualTextImpl(serialized.data!));
        } else {
          const element = new VirtualElementImpl(serialized.tagName!);

          // Restore attributes
          for (const [name, value] of Object.entries(
            serialized.attributes || {}
          )) {
            element.setAttribute(name, value);
          }

          nodeMap.set(serialized.id, element);
        }
      }

      // Second pass: rebuild tree structure
      for (const serialized of data.nodes) {
        if (serialized.type === 'element' && serialized.children) {
          const parent = nodeMap.get(serialized.id) as VirtualElementImpl;

          for (const childId of serialized.children) {
            const child = nodeMap.get(childId);
            if (child) {
              parent.appendChild(child);
            }
          }
        }
      }

      // Replace document
      const root = nodeMap.get(data.rootId) as VirtualDocumentImpl;
      if (root) {
        this.document = root;
      }

      span.setAttribute('nodeCount', data.nodes.length);

      logger.info('DOM deserialized', {
        operation: 'deserialize',
        nodeCount: data.nodes.length,
      });
    }) as void;
  }

  /**
   * Get statistics
   */
  getStats(): DOMStats {
    let elementCount = 0;
    let textCount = 0;
    let maxDepth = 0;

    const countNodes = (node: VirtualNode, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth);

      if (isVirtualText(node)) {
        textCount++;
      } else {
        elementCount++;
        for (const child of node.children) {
          countNodes(child, depth + 1);
        }
      }
    };

    countNodes(this.document, 0);

    return {
      elementCount,
      textCount,
      totalNodes: elementCount + textCount,
      maxDepth,
    };
  }

  /**
   * Export DOM as HTML
   */
  exportHTML(): string {
    return this.document.outerHTML;
  }

  /**
   * Clear the document
   */
  clear(): void {
    this.document.body.children.length = 0;
    this.document.head.children.length = 0;

    logger.info('DOM cleared', { operation: 'clear' });
  }
}

export interface DOMStats {
  elementCount: number;
  textCount: number;
  totalNodes: number;
  maxDepth: number;
}

/**
 * Type guards
 */
function isVirtualElement(node: VirtualNode): node is VirtualElementImpl {
  return 'tagName' in node;
}

function isVirtualText(node: VirtualNode): node is VirtualText {
  return 'data' in node && !('tagName' in node);
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Create a new virtual DOM
 */
export function createVirtualDOM(): VirtualDOM {
  return new VirtualDOMImpl();
}
