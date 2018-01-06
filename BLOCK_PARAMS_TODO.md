- need to implement static path
- rename @main to @block?

- cleanup hax
  - Cleanup labels in guardedAppend
  - Move IS_BLOCK label to value?
  - What to do with DestructureBlock and UnwrapBlock
  - ???

- tests to write:
  - should be able to {{yield}} to something passed in through @main=...
  - should be able to {{yield to="inverse"}} to something passed in through @else=...
  - should confirm what happens if both @main and block are passed:
    - {{#my-component @main=block}} hello {{/my-component}}
  - arguments work {{@main a b}}

