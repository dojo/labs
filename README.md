# @dojo/labs

Early access to future and experimental Dojo features. You can expect to find ideas from the Dojo core team and the community and will be released on an ad-hoc basis outside of the usual Dojo release cadence.

The goal of the features from `@dojo/labs` is to be promoted into the main Dojo framework....!

## Rules of Engagement

`@dojo/labs` is designed to be a playground to test out and provide early access to upcoming features/ideas from Dojo core team and the community. However there are still standards and rules that will need to met.

1) All features need to be fully tested and documented.
1) Features will have approximately 6 months (two major Dojo releases) to be promoted, after which they will be removed from labs repository.

## Adding a new labs feature

`@dojo/labs` is a mono-repo, meaning that each feature will be released under the `@dojo-labs` scope with the name specified in the `package.json`.

To add a new package to `@dojo/labs`, create a directory in the `packages` directory and add code away!

Each package will need to implement the following `npm scripts`:

 * `test`
   * Run all tests for the package.
* `build`
   * Build the package ready for distribution
