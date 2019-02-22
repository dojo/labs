# `@dojo-labs/resources`

`@dojo-labs/resources` is designed to provide a generic mechanism using `@dojo/framework/stores` for working with and managing resources consistently throughout your application.

## Basic Usage

### Reading Resources

Starting with creating and registering a `@dojo/framework/stores/Store` in the application's `main`:

> src/main.tsx
```tsx
import renderer from '@dojo/framework/widget-core/vdom';
import { tsx } from '@dojo/framework/widget-core/tsx';
import Store from '@dojo/framework/stores/Store';
import { registerStoreInjector } from '@dojo/framework/stores/StoreInjector';

import MyWidget from './widgets/MyWidget';

// create a store instance
const store = new Store();
// Register the store
const registry = registerStoreInjector(store);

const r = renderer(() => <MyWidget />);
// Pass the registry to the vdom on mount to make it available to your application
r.mount({ registry });
```

Create resource providers required by the application. The resource provider accepts a configuration to tell it how to deal with working with the resource.

> src/TodoResourceProvider.ts
```ts
import resourceProvider from '@dojo-labs/resources/ResourceProvider';

interface TodoResource {
	id: string;
	title: string;
	completed?: boolean;
}

export default resourceProvider<TodoResource>({
	// template to transform the resource items loaded
	template: (item: TodoResource) => item,
	read: () => {
		// fetch/load and the resource however required and return
		// the read function supports returning an async response
		return { data: [], status: ResourceResponseStatus.success };
	}
});
```

Use the `TodoResourceProvider` in the application where the data is needed:

> src/widgets/MyWidget.tsx
```tsx
import { WidgetBase } from '@dojo/framework/widget-core/WidgetBase';

export default class MyWidget extends WidgetBase {
	protected render() {
		return (
			<TodoResourceProvider renderer={(todoResource) => {
				const todos = todoResource.getOrRead();
				return todos.map((todo) => {
					return (
						<div>
							<div>{todo.id}</div>
							<div>{todo.title}</div>
							<div>{todo.completed ? 'completed' : 'incomplete'}</div>
						</div>
					);
				})
			}}/>
		);
	}
}
```

### Reading Restful Resources

Resources are a generic mechanism to deal with any resource within your application, however a common need is to load resources from a remote Restful service. To support this `@dojo-labs/resources` provides a configuration factory for dealing with these restful services, with default set od configurations.


> src/TodoResourceProvider.ts
```ts
import resourceProvider from '@dojo-labs/resources/ResourceProvider';
import restResourceConfig from '@dojo-labs/resources/RestResourceConfig';

interface TodoResource {
	id: string;
	title: string;
	completed?: boolean;
}

const todoResourceConfig = restResourceConfig({
	origin: 'https://my-todo-service.com',
	name: 'todo'
});

export default resourceProvider<TodoResource>(todoResourceConfig);
```

Using the default configuration when calling `getOrRead` from the resource in your application will result in a `fetch` call to load the resources asynchronously, which will be available to your application once the request has completed.

Using the default configuration, `getOrRead` will result in `GET` request to `https://my-todo-service/com/todo`.
