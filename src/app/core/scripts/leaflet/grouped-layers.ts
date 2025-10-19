/* eslint-disable @typescript-eslint/no-explicit-any */
import L from 'leaflet';
import { ALL_GROUP_KEYS } from '../../models/map.model';

/**
 * L.Control.GroupedLayers - Layer control with groupings and exclusivity
 * Adapté pour TypeScript / Angular
 */
(L.Control as any).GroupedLayers = L.Control.extend({
  options: {
    collapsed: true,
    position: 'topright',
    autoZIndex: true,
    exclusiveGroups: [] as string[],
    groupCheckboxes: false,
  },

  initialize: function (
    baseLayers: Record<string, any>,
    groupedOverlays: Record<string, any>,
    options: any,
  ) {
    L.Util.setOptions(this, options);

    (this as any)._layers = [];
    (this as any)._lastZIndex = 0;
    (this as any)._handlingClick = false;
    (this as any)._groupList = [];
    (this as any)._domGroups = [];

    // Ajoute uniquement les layers valides
    for (const key in baseLayers) {
      const layer = baseLayers[key];
      if (layer && typeof layer === 'object' && 'addTo' in layer) {
        (this as any)._addLayer(layer, key);
      }
    }

    for (const group in groupedOverlays) {
      for (const key in groupedOverlays[group]) {
        const layer = groupedOverlays[group][key];
        if (layer && typeof layer === 'object' && 'addTo' in layer) {
          (this as any)._addLayer(layer, key, group, true);
        }
      }
    }
  },

  onAdd: function (map: any) {
    (this as any)._initLayout();
    (this as any)._update();

    map
      .on('layeradd', (this as any)._onLayerChange, this)
      .on('layerremove', (this as any)._onLayerChange, this);

    return (this as any)._container;
  },

  onRemove: function (map: any) {
    map
      .off('layeradd', (this as any)._onLayerChange)
      .off('layerremove', (this as any)._onLayerChange);
  },

  addBaseLayer: function (layer: any, name: string) {
    if (!layer || typeof layer !== 'object' || !('addTo' in layer)) return this;
    (this as any)._addLayer(layer, name);
    (this as any)._update();
    return this;
  },

  addOverlay: function (layer: any, name: string, group?: string) {
    if (!layer || typeof layer !== 'object' || !('addTo' in layer)) return this;
    (this as any)._addLayer(layer, name, group, true);
    (this as any)._update();
    return this;
  },

  removeLayer: function (layer: any) {
    if (!layer || typeof layer !== 'object' || !('addTo' in layer)) return this;
    const id = L.Util.stamp(layer);
    const _layer = (this as any)._getLayer(id);
    if (_layer) {
      const index = (this as any)._layers.indexOf(_layer);
      if (index !== -1) (this as any)._layers.splice(index, 1);
    }
    (this as any)._update();
    return this;
  },

  _getLayer: function (id: any) {
    for (const obj of (this as any)._layers) {
      if (obj && L.stamp(obj.layer) === id) return obj;
    }
    return null;
  },

  _indexOf: function (arr: any[], obj: any) {
    return arr.indexOf(obj);
  },

  _initLayout: function () {
    const className = 'leaflet-control-layers';
    const container = ((this as any)._container = L.DomUtil.create(
      'div',
      className,
    ));
    container.setAttribute('aria-haspopup', 'true');

    if (L.Browser.touch) {
      L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    } else {
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(container, 'wheel', L.DomEvent.stopPropagation);
    }

    const form = ((this as any)._form = L.DomUtil.create(
      'form',
      className + '-list',
    ));

    if ((this as any).options.collapsed) {
      if (!L.Browser.android) {
        L.DomEvent.on(container, 'mouseover', (this as any)._expand, this).on(
          container,
          'mouseout',
          (this as any)._collapse,
          this,
        );
      }

      const link = ((this as any)._layersLink = L.DomUtil.create(
        'a',
        className + '-toggle',
        container,
      ));
      link.href = '#';
      link.title = 'Layers';

      if (L.Browser.touch) {
        L.DomEvent.on(link, 'click', L.DomEvent.stop).on(
          link,
          'click',
          (this as any)._expand,
          this,
        );
      } else {
        L.DomEvent.on(link, 'focus', (this as any)._expand, this);
      }

      (this as any)._map.on('click', (this as any)._collapse, this);
    } else {
      (this as any)._expand();
    }

    (this as any)._baseLayersList = L.DomUtil.create(
      'div',
      className + '-base',
      form,
    );
    (this as any)._separator = L.DomUtil.create(
      'div',
      className + '-separator',
      form,
    );
    (this as any)._overlaysList = L.DomUtil.create(
      'div',
      className + '-overlays',
      form,
    );

    container.appendChild(form);
  },

  _addLayer: function (
    layer: any,
    name: string,
    group?: string,
    overlay?: boolean,
  ) {
    // Ignore seulement les valeurs non-objet ou null
    if (!layer || typeof layer !== 'object') return;

    L.Util.stamp(layer);
    const _layer: any = { layer, name, overlay };
    (this as any)._layers.push(_layer);

    group = group || '';
    let groupId = (this as any)._indexOf((this as any)._groupList, group);
    if (groupId === -1) groupId = (this as any)._groupList.push(group) - 1;

    const exclusive =
      (this as any)._indexOf((this as any).options.exclusiveGroups, group) !==
      -1;

    _layer.group = {
      name: group,
      id: groupId,
      exclusive,
      key: group
    };

    if (
      (this as any).options.autoZIndex &&
      typeof layer.setZIndex === 'function'
    ) {
      (this as any)._lastZIndex++;
      layer.setZIndex((this as any)._lastZIndex);
    }
  },

  _update: function () {
    if (!(this as any)._container) return;

    (this as any)._baseLayersList.innerHTML = '';
    (this as any)._overlaysList.innerHTML = '';
    (this as any)._domGroups.length = 0;

    let baseLayersPresent = false;
    let overlaysPresent = false;

    for (const obj of (this as any)._layers) {
      (this as any)._addItem(obj);
      overlaysPresent = overlaysPresent || obj.overlay;
      baseLayersPresent = baseLayersPresent || !obj.overlay;
    }

    (this as any)._separator.style.display =
      overlaysPresent && baseLayersPresent ? '' : 'none';
  },

  _createRadioElement: function (name: string, checked: boolean) {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.className = 'leaflet-control-layers-selector';
    radio.name = name;
    radio.checked = checked;
    return radio;
  },

  _addItem: function (obj: any) {
    const label = document.createElement('label');
    let input: HTMLInputElement;
    const checked = (this as any)._map.hasLayer(obj.layer);
    let container: HTMLElement;

    if (obj.overlay) {
      if (obj.group.exclusive) {
        input = this._createRadioElement(
          'leaflet-exclusive-group-layer-' + obj.group.id,
          checked,
        );
      } else {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'leaflet-control-layers-selector';
        input.checked = checked;
      }
    } else {
      input = this._createRadioElement('leaflet-base-layers', checked);
    }

    (input as any).layerId = L.Util.stamp(obj.layer);
    (input as any).groupID = obj.group.id;
    L.DomEvent.on(input, 'click', this._onInputClick, this);

    const nameSpan = document.createElement('span');
    nameSpan.innerHTML = ' ' + obj.name;

    label.appendChild(input);
    label.appendChild(nameSpan);

    if (obj.overlay) {
      container = (this as any)._overlaysList;
      let groupContainer = (this as any)._domGroups[obj.group.id];

      if (!groupContainer) {
        groupContainer = document.createElement('div');
        groupContainer.className = 'leaflet-control-layers-group';
        groupContainer.id = 'leaflet-control-layers-group-' + obj.group.id;

        const groupLabel = document.createElement('label');
        groupLabel.className = 'leaflet-control-layers-group-label';

        if (
          obj.group.name &&
          !obj.group.exclusive &&
          (this as any).options.groupCheckboxes
        ) {
          const groupInput = document.createElement('input');
          groupInput.type = 'checkbox';
          groupInput.className = 'leaflet-control-layers-group-selector';
          (groupInput as any).groupID = obj.group.id;
          (groupInput as any).legend = this;

          // Pas optimum dynamiquement pour i18n mais fait le café
          if (ALL_GROUP_KEYS.includes(obj.group.name)) {
            groupInput.checked = true;
          }

          L.DomEvent.on(
            groupInput,
            'click',
            this._onGroupInputClick,
            groupInput,
          );
          groupLabel.appendChild(groupInput);
        }

        const groupName = document.createElement('span');
        groupName.className = 'leaflet-control-layers-group-name';
        groupName.innerHTML = obj.group.name;
        groupLabel.appendChild(groupName);

        groupContainer.appendChild(groupLabel);
        container.appendChild(groupContainer);

        (this as any)._domGroups[obj.group.id] = groupContainer;
      }

      container = groupContainer;
    } else {
      container = (this as any)._baseLayersList;
    }

    container.appendChild(label);
    return label;
  },

  _onInputClick: function () {
    (this as any)._handlingClick = true;

    const inputs = (this as any)._form.getElementsByTagName('input');
    for (const input of inputs as any) {
      if (input.className !== 'leaflet-control-layers-selector') continue;
      const obj = (this as any)._getLayer(input.layerId);
      if (!obj) continue;

      if (input.checked && !(this as any)._map.hasLayer(obj.layer)) {
        (this as any)._map.addLayer(obj.layer);
      } else if (!input.checked && (this as any)._map.hasLayer(obj.layer)) {
        (this as any)._map.removeLayer(obj.layer);
      }
    }

    (this as any)._handlingClick = false;
  },

  _onGroupInputClick: function (this: any, e: Event) {
    const groupInput = e.target as any;
    const legend = groupInput.legend;
    legend._handlingClick = true;

    const inputs = legend._form.getElementsByTagName('input');
    for (const input of inputs as any) {
      if (input.groupID !== groupInput.groupID) continue;
      if (input.className !== 'leaflet-control-layers-selector') continue;

      const obj = legend._getLayer(input.layerId);
      if (!obj) continue;

      input.checked = groupInput.checked;
      if (input.checked && !legend._map.hasLayer(obj.layer)) {
        legend._map.addLayer(obj.layer);
      } else if (!input.checked && legend._map.hasLayer(obj.layer)) {
        legend._map.removeLayer(obj.layer);
      }
    }

    legend._handlingClick = false;
  },

  _expand: function () {
    L.DomUtil.addClass(
      (this as any)._container,
      'leaflet-control-layers-expanded',
    );
    const acceptableHeight =
      (this as any)._map._size.y - (this as any)._container.offsetTop * 4;
    if (acceptableHeight < (this as any)._form.clientHeight) {
      L.DomUtil.addClass(
        (this as any)._form,
        'leaflet-control-layers-scrollbar',
      );
      (this as any)._form.style.height = acceptableHeight + 'px';
    }
  },

  _collapse: function () {
    L.DomUtil.removeClass(
      (this as any)._container,
      'leaflet-control-layers-expanded',
    );
  },
});

// Factory pour Angular/TypeScript
(L.control as any).groupedLayers = function (
  baseLayers: any,
  groupedOverlays: any,
  options: any,
) {
  return new (L.Control as any).GroupedLayers(
    baseLayers,
    groupedOverlays,
    options,
  );
};

export {};
