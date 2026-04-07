export interface SvgPoint {
  x: number;
  y: number;
}

export interface SerializedSvgTextNode {
  kind: "text";
  value: string;
}

export interface SerializedSvgElementNode {
  kind: "element";
  tagName: string;
  attributes: Record<string, string>;
  children: SerializedSvgChild[];
}

export type SerializedSvgChild = SerializedSvgElementNode | SerializedSvgTextNode;

export interface SvgRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SimpleCubicBezier {
  start: SvgPoint;
  control1: SvgPoint;
  control2: SvgPoint;
  end: SvgPoint;
}

export type NodeKey = string;
export type ResizeCornerHandle = "nw" | "ne" | "se" | "sw";
export type LineEndpointHandle = "start" | "end";
export type PathBezierHandleKey = keyof SimpleCubicBezier;
export type PointHandleKey = `point-${number}`;

export type EditorSvgElement = SVGElement & {
  dataset: DOMStringMap & {
    editorId?: string;
  };
};

export type SvgGraphicsNode = SVGGraphicsElement & EditorSvgElement;
export type SvgTextNode = SVGTextElement & SvgGraphicsNode;
export type SvgPathNode = SVGPathElement & SvgGraphicsNode;
export type SvgSvgNode = SVGSVGElement & EditorSvgElement;

export interface SvgRuntimeStateLike {
  svgRoot: SvgSvgNode | null;
  documentSnapshot: SerializedSvgElementNode | null;
  documentRevision: number;
  nodeMap: Map<string, EditorSvgElement>;
  selectedId: string | null;
  nextId: number;
  warnings: string[];
  gridSnapEnabled: boolean;
  gridSnapSize: number;
  lockedNodeKeys: Set<NodeKey>;
  nodeKeyByEditorId: Map<string, NodeKey>;
  editorIdByNodeKey: Map<NodeKey, string>;
  nodeKeyByNode: WeakMap<Element, NodeKey>;
}

export interface FieldDefinition {
  key: string;
  kind: string;
}

export interface ResolveEditableNodeOptions {
  preferredNode?: Element | null;
}

export interface ViewportTools {
  getNumericAttr(node: Element, attrName: string, fallback?: number): number;
  getNodeVisualBounds(node: Element | null | undefined): SvgRect | null;
  getViewBoxRect(root?: SvgSvgNode | null): SvgRect;
  normalizeRect(rect: RectLike | null | undefined): SvgRect | null;
  roundCoordinate(value: number): number;
  toLocalPoint(referenceNode: SVGGraphicsElement | SVGSVGElement, clientX: number, clientY: number): SvgPoint;
  viewBoxFor(root: SvgSvgNode | null | undefined): string;
}

export interface SnapTools {
  getGridMetrics(): GridMetrics;
  snapCoordinate(value: number, step: number, origin: number): number;
  snapFieldValue(fieldKey: string, value: string): string;
  snapNodeToGrid(node: Element | null | undefined): void;
}

export interface GridMetrics {
  originX: number;
  originY: number;
  stepX: number;
  stepY: number;
}

export interface PathBezierHandle {
  key: PathBezierHandleKey;
  kind: "anchor" | "control";
  x: number;
  y: number;
}

export interface PathBezierHandleDescriptor {
  handle: PathBezierHandleKey;
  startHandle: SvgPoint;
}

export interface PathTools {
  applyPathBezierHandle(node: SvgPathNode, descriptor: PathBezierHandleDescriptor, point: SvgPoint): boolean;
  getPathBezier(node: SvgPathNode): SimpleCubicBezier | null;
  getPathBezierHandleDescriptor(node: SvgPathNode, handle: string): PathBezierHandleDescriptor | null;
  getPathBezierHandles(node: SvgPathNode): PathBezierHandle[];
  parseSimpleCubicBezier(node: Element | null | undefined): SimpleCubicBezier | null;
  serializeSimpleCubicBezier(bezier: SimpleCubicBezier): string;
  tokenizePathData(d: string | null | undefined): string[];
  translatePathData(d: string | null | undefined, dx: number, dy: number): string;
  translateSimpleCubicBezier(bezier: SimpleCubicBezier, dx: number, dy: number): SimpleCubicBezier;
  updatePathBezier(node: SvgPathNode, bezier: Partial<SimpleCubicBezier>): boolean;
}

export interface ShapeFactoryTools {
  createElementNode(kind: string): EditorSvgElement;
  createImageNodeFromFile(file: File): Promise<SVGImageElement & EditorSvgElement>;
  getInsertParent(): EditorSvgElement | null;
}

export interface ResizeHandleDescriptor {
  key: string;
  cursor: string;
  x: number;
  y: number;
}

export interface PointHandleDescriptor {
  index: number;
  mode: "point-handle";
  points: SvgPoint[];
  startHandle: SvgPoint;
}

export interface DragDescriptorXY {
  mode: "xy";
  x: number;
  y: number;
}

export interface DragDescriptorTextXY {
  mode: "text-xy";
  x: number;
  y: number;
  tspans: Array<{
    node: SVGTSpanElement;
    x: number | null;
    y: number | null;
  }>;
}

export interface DragDescriptorCenter {
  mode: "center";
  cx: number;
  cy: number;
}

export interface DragDescriptorLine {
  mode: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DragDescriptorPolyline {
  mode: "polyline" | "polygon";
  box: SvgRect | null;
  points: SvgPoint[];
}

export interface DragDescriptorPath {
  mode: "path";
  box: SvgRect | null;
  bezier: SimpleCubicBezier | null;
  d: string;
}

export interface DragDescriptorTransform {
  mode: "transform";
  baseMatrix: DOMMatrixReadOnly | DOMMatrix | SVGMatrix | {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
  };
}

export type DragDescriptor =
  | DragDescriptorXY
  | DragDescriptorTextXY
  | DragDescriptorCenter
  | DragDescriptorLine
  | DragDescriptorPolyline
  | DragDescriptorPath
  | DragDescriptorTransform;

interface ResizeDescriptorBase {
  handle: string;
  referenceNode: SVGGraphicsElement | SVGSVGElement;
  startHandle: SvgPoint;
}

export interface LineEndpointResizeDescriptor extends ResizeDescriptorBase {
  mode: "line-endpoint";
  handle: LineEndpointHandle;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RectResizeDescriptor extends ResizeDescriptorBase {
  mode: "rect";
  handle: ResizeCornerHandle;
  box: SvgRect;
  anchor: SvgPoint;
  rx: number;
  ry: number;
}

export interface CircleResizeDescriptor extends ResizeDescriptorBase {
  mode: "circle";
  handle: ResizeCornerHandle;
  box: SvgRect;
  anchor: SvgPoint;
}

export interface EllipseResizeDescriptor extends ResizeDescriptorBase {
  mode: "ellipse";
  handle: ResizeCornerHandle;
  box: SvgRect;
  anchor: SvgPoint;
}

export interface PolyResizeDescriptor extends ResizeDescriptorBase {
  mode: "polyline" | "polygon";
  handle: ResizeCornerHandle;
  box: SvgRect;
  anchor: SvgPoint;
  points: SvgPoint[];
}

export interface PathResizeDescriptor extends ResizeDescriptorBase {
  mode: "path-bezier-resize";
  handle: ResizeCornerHandle;
  box: SvgRect;
  anchor: SvgPoint;
  bezier: SimpleCubicBezier;
}

export interface TextBoxResizeDescriptor extends ResizeDescriptorBase {
  mode: "text-box";
  handle: ResizeCornerHandle;
  box: SvgRect;
  anchor: SvgPoint;
  anchorHandle: ResizeCornerHandle;
}

export type ResizeDescriptor =
  | LineEndpointResizeDescriptor
  | RectResizeDescriptor
  | CircleResizeDescriptor
  | EllipseResizeDescriptor
  | PolyResizeDescriptor
  | PathResizeDescriptor
  | TextBoxResizeDescriptor;

export interface DragResizeTools {
  applyPointHandle(node: EditorSvgElement, descriptor: PointHandleDescriptor, point: SvgPoint): boolean;
  applyDrag(node: EditorSvgElement, descriptor: DragDescriptor, dx: number, dy: number): void;
  applyResize(node: EditorSvgElement, descriptor: ResizeDescriptor, point: SvgPoint): void;
  canDragNode(node: Element | null | undefined): boolean;
  canResizeNode(node: Element | null | undefined): boolean;
  getDragDescriptor(node: EditorSvgElement): DragDescriptor;
  getPointHandleDescriptor(node: EditorSvgElement, handle: string): PointHandleDescriptor | null;
  getPointHandles(node: EditorSvgElement): ResizeHandleDescriptor[];
  getPolygonSideCount(node: Element | null | undefined): number;
  getPolylinePointCount(node: Element | null | undefined): number;
  regularizePolygon(node: Element | null | undefined): boolean;
  regularizePolygonEqualSides(node: Element | null | undefined): boolean;
  getResizeDescriptor(node: EditorSvgElement, handle: string): ResizeDescriptor | null;
  getResizeHandles(node: EditorSvgElement): ResizeHandleDescriptor[];
  getTextBoxDimension(node: Element | null | undefined, key: string): string;
  normalizeManagedTextNodes(root?: ParentNode | null): boolean;
  refreshTextLayout(node: Element | null | undefined): boolean;
  updatePolygonSideCount(node: Element | null | undefined, nextCount: string | number): boolean;
  updatePolylinePointCount(node: Element | null | undefined, nextCount: string | number): boolean;
  updateTextBoxDimension(node: Element | null | undefined, key: string, value: string): boolean;
  updateTextContent(node: Element | null | undefined, value: string): boolean;
}

export interface DocumentTools {
  captureDocumentSnapshot(root?: Element | null): SerializedSvgElementNode | null;
  parseSvg(source: string): SvgSvgNode;
  remapSubtreeIds(root: Element): void;
  renameNodeId(node: Element, requestedId?: string): string;
  serialize(): string;
}

export interface MetadataTools {
  addEditorIds(root: Element): void;
  getEditorIdByNodeKey(nodeKey: string): string | null;
  getNodeKey(node: Element | null | undefined): string | null;
  getNodeKeyByEditorId(editorId: string): string | null;
  getRenderableChildren(node: Element): Element[];
  getZOrder(node: Element | null | undefined): string;
  isNodeHidden(node: Element | null | undefined): boolean;
  isNodeLocked(node: Element | null | undefined): boolean;
  labelFor(node: Element): string;
  rebuildNodeMap(): void;
  resolveEditableNode(node: Element | null | undefined, options?: ResolveEditableNodeOptions): Element | null;
  resolveSelectionEditorId(editorId: string, options?: ResolveEditableNodeOptions): string;
  setZOrder(node: Element | null | undefined, requestedOrder: string | number): boolean;
  syncEditorMetadata(): void;
  visibleField(node: Element, field: FieldDefinition): boolean;
}

export type SvgModel = DocumentTools & MetadataTools & ViewportTools & SnapTools & PathTools & ShapeFactoryTools & DragResizeTools;

export type RectLike = Pick<DOMRectReadOnly, "x" | "y" | "width" | "height"> | SVGRect;
