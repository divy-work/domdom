import Data from '@eirikb/data';
import {isPlainObject} from '../node_modules/@eirikb/data/src/common';

function or(res) {
  res.or = (val) => {
    res.oror = val;
    return res;
  };
  return res;
}

export default (data = Data()) => {
  const self = {data};

  self.React = {
    createElement(tagName, props, ...children) {
      const listeners = [];
      const wrapper = {};
      const listenersQueue = [];

      function destroy() {
        delete wrapper.element;
        data.off(listeners.join(' '));
      }

      function createElement() {
        if (typeof tagName === 'function') {
          const options = {
            input: (props || {})['dd-input'],
            ...self
          };

          Object.entries(props || {})
            .filter(([key]) => key.match(/^dd-input-/))
            .forEach(([key, value]) =>
              options[key.split('-').slice(2).join('')] = value
            );

          return tagName(options).create();
        } else {
          return document.createElement(tagName);
        }
      }

      function create(pp) {
        if (wrapper.element) return wrapper.element;

        self.path = pp || self.path;
        const element = createElement();
        wrapper.element = element;

        listenersQueue.forEach(({pathAndFlags, listener}) =>
          wrapper.on(pathAndFlags, listener));

        const slots = [];

        function appendChild(index, child, path, sort) {
          removeChild(index, path);
          if (!child) return;

          if (path) {
            listeners.push(data.on('- ' + path, () =>
              removeChild(index, path)
            ));
          }

          let before = slots.slice(index + 1).find(slot => slot);
          if (typeof child === 'function') child = child(self);
          let toAdd;
          if (child.create) toAdd = child.create(path);
          else if (child.nodeName) toAdd = child;
          else toAdd = document.createTextNode(child);

          let beforeElement;
          if (before) {
            beforeElement = before.element;
          }

          const selfSlot = slots[index];
          if (path && !sort) {
            sort = (a, b, aPath, bPath) => aPath.localeCompare(bPath)
          }

          if (selfSlot && sort) {
            const keys = Object.keys(slots[index]).filter(key => key !== 'element' && key !== 'destroy');
            keys.push(path);
            keys.sort((a, b) => sort(data.get(a), data.get(b), a, b));
            const beforeKey = keys[keys.indexOf(path) + 1];
            if (beforeKey) {
              beforeElement = selfSlot[beforeKey].element;
            }
          }

          if (beforeElement) {
            element.insertBefore(toAdd, beforeElement);
          } else {
            element.appendChild(toAdd);
          }
          const slot = (path && slots[index]) || {};
          slot.element = toAdd;
          if (child.destroy) {
            slot.destroy = child.destroy;
          }
          if (path) {
            slot[path] = {element: toAdd, destroy: child.destroy};
          }
          slots[index] = slot;
        }

        function removeChild(index, path) {
          let slot = slots[index];
          if (slot && path) {
            const pathSlot = slot[path];
            if (pathSlot) {
              element.removeChild(pathSlot.element);
              delete slot[path];
              if (Object.keys(slot).length === 2) {
                delete slots[index];
              }
            }
            return;
          }
          if (slot) {
            element.removeChild(slot.element);
            if (slot.destroy) {
              slot.destroy();
            }
            delete slots[index];
          }
        }

        function on(path, listener) {
          if (path.match(/^>/)) {
            path = (self.path || '') + path.slice(1);
          }
          listeners.push(data.on('!+* ' + path, listener));
        }

        function setElementValue(key, value) {
          if (value && value.then) {
            value.then(res => setElementValue(key, res));
          } else {
            if (isPlainObject(value) && element[key]) {
              Object.assign(element[key], value);
            } else {
              element[key] = value;
            }
          }
        }

        let counter = 0;
        for (let child of [].concat(...children)) {
          const index = counter++;
          if (typeof child === 'undefined') {
          } else if (child.create) {
            appendChild(index, child);
          } else if (child.when) {
            const l = child.when.listener;
            const whens = Array.isArray(l) ? l : [val => val, l];

            for (let i = 0; i < whens.length; i += 2) {
              on(child.when.path, (res, o) => {
                const conditional = whens[i];
                const listener = whens[i + 1];
                let add = false;
                if (typeof conditional === 'function') {
                  add = conditional(res);
                } else {
                  add = res === conditional;
                }
                const pathPos = `${i}-${o.path}`;
                if (add) {
                  appendChild(index, listener(res, o), pathPos);
                } else {
                  removeChild(index, pathPos);
                }
              });
            }
          } else if (child.on) {
            if (child.oror) {
              appendChild(index, child.oror);
            }
            on(child.on.path, (res, o) =>
              appendChild(index, child.on.listener(res, o), o.path, child.on.sort)
            );
          } else if (child.text) {
            const text = document.createTextNode(child.oror || '');
            on(child.text, (value) => text.nodeValue = value);
            appendChild(index, text);
          } else {
            appendChild(index, child);
          }
        }

        if (props) {
          const eventProps = Object.entries(props).filter(([key]) => key.match(/^on[A-Z]/));
          for (let [key, value] of eventProps) {
            const event = key[2].toLowerCase() + key.slice(3);
            element.addEventListener(event, value);
          }

          const model = props['dd-model'];
          if (model) {
            element.addEventListener('keyup', () => data.set(model, element.value));
            element.addEventListener('input', () => data.set(model, element.value));
            element.addEventListener('value', () => data.set(model, element.value));
            on(model, (value) => element.value = value);
          }

          const nonSpecialProps = Object.entries(props).filter(([key]) => !key.match(/(^dd-|on[A-Z])/));
          for (let [key, value] of nonSpecialProps) {
            if (key === 'class') {
              key = 'className';
            }
            setElementValue(key, value);
          }
        }

        return element;
      }

      wrapper.destroy = destroy;
      wrapper.create = create;

      wrapper.on = (pathAndFlags, listener) => {
        if (!wrapper.element) {
          listenersQueue.push({pathAndFlags, listener});
          return;
        }

        pathAndFlags = pathAndFlags.replace(/ >/, ' ' + self.path);
        listeners.push(data.on(pathAndFlags, listener));
      };

      return wrapper;
    }
  };

  self.render = (template) => {
    return template(self).create();
  };

  self.on = (path, listener, sort) => {
    return or({on: {path, listener, sort}});
  };

  self.when = (path, listener) => {
    return {when: {path, listener}};
  };

  self.text = (path) => {
    return or({text: path});
  };

  self.set = (path, value) => {
    data.set(path, value)
  };

  self.get = (path) => {
    return data.get(path);
  };

  self.trigger = (path, value) => {
    return data.trigger(path, value);
  };

  self.unset = (path) => data.unset(path);

  self.global = () => {
    if (typeof global !== 'undefined') {
      Object.assign(global, self);
    }
    if (typeof window !== 'undefined') {
      Object.assign(window, self);
    }
  };

  return self;
}
