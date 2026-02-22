import * as L from 'leaflet';

declare module 'leaflet' {
  namespace Control {
    class MiniMap extends L.Control {
      constructor(layer: L.TileLayer, options?: MiniMapOptions);
      changeLayer(layer: L.TileLayer): this;
      on(type: string, fn: L.LeafletEventHandlerFn, context?: any): this;
      off(type: string, fn?: L.LeafletEventHandlerFn, context?: any): this;
    }

    interface MiniMapOptions extends L.ControlOptions {
      toggleDisplay?: boolean;
      zoomLevelOffset?: number;
      zoomLevelFixed?: number | false;
      centerFixed?: L.LatLngExpression | false;
      zoomAnimation?: boolean;
      autoToggleDisplay?: boolean;
      minimized?: boolean;
      width?: number;
      height?: number;
      collapsedWidth?: number;
      collapsedHeight?: number;
      aimingRectOptions?: L.PathOptions;
      shadowRectOptions?: L.PathOptions;
      strings?: { hideText?: string; showText?: string };
      mapOptions?: L.MapOptions;
    }
  }
}
