# API

A service layer for hapi

> **Note**
>
> Schmervice is intended for use with hapi v20+ and nodejs v16+ (_see v2 for lower support_).

## The hapi plugin
### Registration
Schmervice may be registered multiple times– it should be registered in any plugin that would like to use any of its features.  It takes no plugin registration options and is entirely configured per-plugin using [`server.registerService()`](#serverregisterserviceservicefactory).

### Server decorations
#### `server.registerService(serviceFactory)`

Registers a service with `server` (which may be a plugin's server or root server).  The passed `serviceFactory` used to define the service object may be any of the following:

 - A service class.  Services are instanced immediately when they are registered, with `server` and corresponding plugin `options` passed to the constructor.  The service class should be named via its natural class `name` or the [`Schmervice.name`](#schmervicename) symbol (see more under [service naming](#service-naming-and-sandboxing)).

    ```js
    server.registerService(
        class MyServiceName {
            constructor(server, options) {}
            someMethod() {}
        }
    );
    ```

 - A factory function returning a service object.  The factory function is called immediately to create the service, with `server` and corresponding plugin `options` passed as arguments.  The service object should be named using either a `name` property or the [`Schmervice.name`](#schmervicename) symbol (see more under [service naming](#service-naming-and-sandboxing)).

    ```js
    server.registerService((server, options) => ({
        name: 'myServiceName',
        someMethod: () => {}
    }));
    ```

 - A service object.  The service object should be named using either a `name` property or the [`Schmervice.name`](#schmervicename) symbol (see more under [service naming](#service-naming-and-sandboxing)).

    ```js
    server.registerService({
        name: 'myServiceName',
        someMethod: () => {}
    });
    ```

 - An array containing any of the above.

    ```js
    server.registerService([
        class MyServiceName {
            constructor(server, options) {}
            someMethod() {}
        },
        {
            name: 'myOtherServiceName',
            someOtherMethod: () => {}
        }
    ]);
    ```

#### `server.services([namespace])`
Returns an object containing each service instance keyed by their [instance names](#service-naming-and-sandboxing).

The services that are available on this object are only those registered by `server` or any plugins for which `server` is an ancestor (e.g. if `server` has registered a plugin that registers services) that are also not [sandboxed](#service-naming-and-sandboxing).  By passing a `namespace` you can obtain the services from the perspective of a different plugin.  When `namespace` is a string, you receive services that are visibile within the plugin named `namespace`.  And when `namespace` is `true`, you receive services that are visibile to the root server: every service registered with the hapi server– across all plugins– that isn't sandboxed.

### Request decorations
#### `request.services([namespace])`
See [`server.services()`](#serverservicesnamespace), where `server` is the one in which the `request`'s route was declared (i.e. based upon `request.route.realm`).

### Response toolkit decorations
#### `h.services([namespace])`
See [`server.services()`](#serverservicesnamespace), where `server` is the one in which the corresponding route or server extension was declared (i.e. based upon `h.realm`).

## Service naming and sandboxing

The name of a service is primarily used to determine the key on the result of [`server.services()`](#serverservicesnamespace) where the service may be accessed.  In the case of service classes, the name is derived from the class's natural `name` (e.g. `class ThisIsTheClassName {}`) by default.  In the case of service objects, including those returned from a function, the name is derived from the object's `name` property by default.  In both cases the name is converted to camel-case.

Sometimes you don't want the name to be based on these properties or you don't want their values camel-cased, which is where [`Schmervice.name`](#schmervicename) and [`Schmervice.withName()`](#schmervicewithnamename-options-servicefactory) can be useful.

Sandboxing is a concept that determines whether a given service is available in the "plugin namespace" accessed using [`server.services()`](#serverservicesnamespace).  By default when you register a service, it is available in the current plugin, and all of that plugin's ancestors up to and including the root server.  A sandboxed service, on the other hand, is only available in the plugin/namespace in which it is registered, which is where [`Schmervice.sandbox`](#schmervicesandbox) and [`Schmervice.withName()`](#schmervicewithnamename-options-servicefactory)'s options come into play.

### `Schmervice.name`

This is a symbol that can be added as a property to either a service class or service object.  Its value should be a string, and this value will be taken literally as the service's name without any camel-casing.  A service class or object's `Schmervice.name` property is always preferred to its natural class name or `name` property, so this property can be used as an override.

```js
server.registerService({
    [Schmervice.name]: 'myServiceName',
    someMethod: () => {}
});

// ...
const { myServiceName } = server.services();
```

### `Schmervice.sandbox`

This is a symbol that can be added as a property to either a service class or service object.  When the value of this property is `true` or `'plugin'`, then the service is not available to [`server.services()`](#serverservicesnamespace) for any namespace aside from that of the plugin that registered the service.  This effectively makes the service "private" within the plugin that it is registered.

The default behavior, which can also be declared explicitly by setting this property to `false` or `'server'`, makes the service available within the current plugin's namespace, and all of the namespaces of that plugin's ancestors up to and including the root server (i.e. the namespace accessed by `server.services(true)`).

```js
server.registerService({
    [Schmervice.name]: 'privateService',
    [Schmervice.sandbox]: true,
    someMethod: () => {}
});

// ...
// Can access the service in the same plugin that registered it
const { privateService } = server.services();

// But cannot access it in other namespaces, e.g. the root namespace, because it is sandboxed
const { privateService: doesNotExist } = server.services(true);
```

### `Schmervice.withName(name, [options], serviceFactory)`

This is a helper that assigns `name` to the service instance or object produced by `serviceFactory` by setting the service's [`Schmervice.name`](#schmervicename).  When `serviceFactory` is a service class or object, `Schmervice.withName()` returns the same service class or object mutated with `Schmervice.name` set accordingly.  When `serviceFactory` is a function, this helper returns a new function that behaves identically but adds the `Schmervice.name` property to its result.  If the resulting service class or object already has a `Schmervice.name` then this helper will fail.

Following a similar logic and behavior to the above: when `options` is present, this helper also assigns `options.sandbox` to the service instance or object produced by `serviceFactory` by setting the service's [`Schmervice.sandbox`](#schmervicesandbox).  If the resulting service class or object already has a `Schmervice.sandbox` then this helper will fail.

```js
server.registerService(
    Schmervice.withName('myServiceName', () => ({
        someMethod: () => {}
    }))
);

// ...
const { myServiceName } = server.services();
```

This is also the preferred way to name a service object from some other library, since it prevents property conflicts.

```js
const Nodemailer = require('nodemailer');

const transport = Nodemailer.createTransport();

server.registerService(Schmervice.withName('emailService', transport));

// ...
const { emailService } = server.services();
```

An example usage of `options.sandbox`:

```js
server.registerService(
    Schmervice.withName('privateService', { sandbox: true }, {
        someMethod: () => {}
    })
);

// ...
// Can access the service in the same plugin that registered it
const { privateService } = server.services();

// But cannot access it in other namespaces, e.g. the root namespace, because it is sandboxed
const { privateService: doesNotExist } = server.services(true);
```

## `Schmervice.Service`
This class is intended to be used as a base class for services registered with schmervice.  However, it is completely reasonable to use this class independently of the [schmervice plugin](#the-hapi-plugin) if desired.

### `new Service(server, options)`
Constructor to create a new service instance. `server` should be a hapi plugin's server or root server, and `options` should be the corresponding plugin `options`.  This is intended to mirror a plugin's [registration function](https://github.com/hapijs/hapi/blob/master/API.md#plugins) `register(server, options)`.  Note: creating a service instance may have side-effects on the `server`, e.g. adding server extensions– keep reading for details.

### `service.server`
The `server` passed to the constructor.  Should be a hapi plugin's server or root server.

### `service.options`
The hapi plugin `options` passed to the constructor.

### `service.context`
The context of `service.server` set using [`server.bind()`](https://github.com/hapijs/hapi/blob/master/API.md#server.bind()).  Will be `null` if no context has been set.  This is implemented lazily as a getter based upon `service.server` so that services can be part of the context without introducing any circular dependencies between the two.

### `service.bind()`
Returns a new service instance where all methods are bound to the service instance allowing you to deconstruct methods without losing the `this` context.

### `async service.initialize()`
This is not implemented on the base service class, but when it is implemented by an extending class then it will be called during `server` initialization (via `onPreStart` [server extension](https://github.com/hapijs/hapi/blob/master/API.md#server.ext()) added when the service is instanced).

### `async service.teardown()`
This is not implemented on the base service class, but when it is implemented by an extending class then it will be called during `server` stop (via `onPostStop` [server extension](https://github.com/hapijs/hapi/blob/master/API.md#server.ext()) added when the service is instanced).

### `service.caching(options)`
Configures caching for the service's methods, and may be called once.  The `options` argument should be an object where each key is the name of one of the service's methods, and each corresponding value is either,

  - An object `{ cache, generateKey }` as detailed in the [server method options](https://github.com/hapijs/hapi/blob/master/API.md#server.method()) documentation.
  - An object containing the `cache` options as detailed in the [server method options](https://github.com/hapijs/hapi/blob/master/API.md#server.method()) documentation.

Note that behind the scenes an actual server method will be created on `service.server` and will replace the respective method on the service instance, which means that any service method configured for caching must be called asynchronously even if its original implementation is synchronous.  In order to configure caching, the service class also must have a `name`, e.g. `class MyServiceName extends Schmervice.Service {}`.

### `Service.caching`
This is not set on the base service class, but when an extending class has a static `caching` property (or getter) then its value will be used used to configure service method caching (via [`service.caching()`](#servicecachingoptions) when the service is instanced).
