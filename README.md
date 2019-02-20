# @dojo/labs

Early access to future and experimental Dojo features. You can expect to find ideas from the Dojo core team and the community and will be released on an ad-hoc basis outside of the usual Dojo release cadence.

The goal of the features from `@dojo/labs` is to be promoted into the main Dojo framework....!

**Not intended for use in production applications. The feature APIs may break from release to release and even disappear. Please be aware**

## Rules of Engagement

`@dojo/labs` is designed to be a playground to test out and provide early access to upcoming features/ideas from the Dojo core team and the Dojo community. However there are still standards and rules that will need to met.

1) All features need to be fully tested and documented.
1) Features will have approximately 6 months (two major Dojo releases) to be promoted, after which they will be removed from the labs repository.

## Adding a new labs feature

`@dojo/labs` is a mono-repo, meaning that each feature will be released under the `@dojo-labs` scope with the name specified in the `package.json`.

To add a new package to `@dojo/labs`, run `npm run create new-package-name` with the new package name from the root of `@dojo/labs`.

Each package will need to implement the following `npm scripts`:

 * `test`
   * Run all tests for the package.
* `build`
   * Build the package ready for distribution

The built files for publishing must get output to `dist/release` directory.

Alternatively, the `package-template` package can be copied and renamed for the new feature.

## Releasing @dojo/labs

@dojo/labs uses [lerna](https://github.com/lerna/lerna/) to manage building and releasing each of the sub projects. To run a release of all features that have been updated since the last release run `npm run release`.

## Licensing information

© 2019 [JS Foundation](https://js.foundation/) & contributors. [New BSD](http://opensource.org/licenses/BSD-3-Clause) license.
