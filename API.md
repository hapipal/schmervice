# API Reference
## The hapi plugin
### Registration
Schmervice may be registered multiple times– it should be registered in any plugin that would like to use any of its features.  It takes no plugin registration options and is entirely configured per-plugin using [`server.registerService()`](#serverregisterserviceserviceclass).

### Server decorations
#### `server.registerService(ServiceClass)`
Registers a service class `ServiceClass` with `server` (which may be a plugin's server or root server).  It also accepts an array of service classes.  Services are instanced immediately when they are registered, with `server` and corresponding plugin `options` passed to the constructor (i.e. `new ServiceClass(server, options)`).  Note that each class must have a `name` (e.g. `class MyServiceName {}`) and that service names must be unique across the entire hapi server.  

#### `server.services([all])`
Returns an object containing each service instance keyed by their instance names (if the class name was pascal-cased `MyServiceName` then the instance name is camel-cased `myServiceName`).  The services that are available on this object are only those registered by `server` or any plugins for which `server` is an ancestor (e.g. if `server` has registered a plugin that registers services).  When `all` is passed as `true` then every service registered with the hapi server– across all plugins– will be returned.

### Request decorations
#### `request.services([all])`
See [`server.services()`](#serverservicesall), where `server` is the one in which the `request`'s route was declared (i.e. based upon `request.route.realm`).

### Response toolkit decorations
#### `h.services([all])`
See [`server.services()`](#serverservicesall), where `server` is the one in which the corresponding route or server extension was declared (i.e. based upon `h.realm`).

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
