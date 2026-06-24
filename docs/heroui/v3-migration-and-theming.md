<!-- Source: https://heroui.com/react/llms-full.txt (HeroUI v3 React docs, LLM format)
     Fetched: 2026-06-24 · Scope: components index + introduction + v2→v3 migration + hooks + styling/theming.
     Assembled from the official llms-full doc because 'heroui agents-md' requires an interactive TTY (unusable in automation).
     Full per-component API: see docs/heroui/v3-react-docs-index.md for URLs, or fetch the full llms-full.txt above. -->

# All Components

**Category**: react
**URL**: https://www.heroui.com/en/docs/react/components
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/index.mdx
> Explore the full list of components available in the library. More are on the way.


## Buttons

<ComponentsCategory category="Buttons" />

## Collections

<ComponentsCategory category="Collections" />

## Colors

<ComponentsCategory category="Colors" />

## Controls

<ComponentsCategory category="Controls" />

## Data Display

<ComponentsCategory category="Data Display" />

## Date and Time

<ComponentsCategory category="Date and Time" />

## Feedback

<ComponentsCategory category="Feedback" />

## Forms

<ComponentsCategory category="Forms" />

## Layout

<ComponentsCategory category="Layout" />

## Media

<ComponentsCategory category="Media" />

## Navigation

<ComponentsCategory category="Navigation" />

## Overlays

<ComponentsCategory category="Overlays" />

## Pickers

<ComponentsCategory category="Pickers" />

## Typography

<ComponentsCategory category="Typography" />

## Utilities

<ComponentsCategory category="Utilities" />

</page>

<page url="/en/docs/react/getting-started">
# Introduction

**Category**: react
**URL**: https://www.heroui.com/en/docs/react/getting-started
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/getting-started/index.mdx
> An open-source UI component library for building beautiful and accessible user interfaces.


HeroUI is a React component library built on [Tailwind CSS v4](https://tailwindcss.com/) and [React Aria Components](https://react-spectrum.adobe.com/react-aria/index.html). Every component comes with smooth animations, polished details, and built-in accessibility—ready to use, fully customizable.



## Why HeroUI?

**Beautiful by default** — Professional look out of the box, no extra styling needed.

**Accessible** — Built on [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html) with focus management, keyboard navigation, and screen reader support.

**Flexible** — Each component is made of customizable parts. Change what you need, leave the rest.

**Developer-friendly** — Fully typed APIs, predictable patterns, and excellent autocompletion.

**Maintained** — We handle updates, bug fixes, and new features. Just update the package.

**Lightweight** — Tree-shaken. Only what you use goes into your app.

**Future-proof** — Built for [React 19](https://react.dev/blog/2024/12/05/react-19) and [Tailwind v4](https://tailwindcss.com/blog/tailwindcss-v4), designed for AI-assisted development.

## A Living Library, Not Copy-Paste

Copy-paste code works until it breaks. You're left maintaining outdated dependencies that stop evolving.

HeroUI is different. It's a living library that grows with you:

* Automatic updates and fixes
* New features without extra work
* Components stay current with React, Tailwind, and browsers
* Deep customization, not shallow theme tweaks
* AI-friendly APIs for code generation

HeroUI v3 is not a snapshot—it's a garden that keeps growing. 🌱

## HeroUI Ecosystem

* **🌐 HeroUI v3** (web) — You're here! React components with Tailwind CSS v4
* **📱 [HeroUI Native](https://link.heroui.com/native)** (mobile) — Beautiful components for React Native
* **🤖 [HeroUI Chat](https://heroui.chat?ref=heroui-v3)** (text-to-app) — Create apps with natural language
* **🧠 UI for LLMs** — New platform & MCPs coming soon

**Why React Aria?** We chose React Aria for accessibility at scale. We've used it since HeroUI v2, and v3 keeps familiar API conventions like `isDisabled` and `onPress`. Thanks to [Devon Govett](https://x.com/devongovett) and the Adobe team.

## FAQ

**Is HeroUI free?**
Yes, completely free and open source under the Apache License 2.0.

**Is it production-ready?**
Yes. HeroUI v3 is stable and ready for production use.

**Can I customize the components?**
Yes! Use Tailwind utilities, CSS variables, [BEM](https://getbem.com/) modifiers, or compose component parts differently. Every slot is customizable.

**Does it work with TypeScript?**
Fully typed with excellent IDE support and autocompletion.

**What about accessibility?**
Built on React Aria Components for WCAG compliance. Keyboard navigation, focus management, and screen reader support included.

**Can I use the styles without React?**
Yes, the CSS can be applied to plain HTML. See our [Tailwind Play example](https://play.tailwindcss.com/vMYXzKPyUx).

**Is there a Figma file?**
Yes! Access our design system at [HeroUI Figma Kit V3](https://www.figma.com/community/file/1546526812159103429).

## Get Involved

Join the community, share feedback, or contribute:

* [GitHub Discussions](https://github.com/heroui-inc/heroui/discussions)
* [Discord](https://discord.gg/9b6yyZKmH4)
* [X/Twitter](https://x.com/hero_ui)
* [Contributing Guidelines](https://github.com/heroui-inc/heroui/blob/main/CONTRIBUTING.md)

HeroUI is released under the [Apache License 2.0](https://github.com/heroui-inc/heroui/blob/main/LICENSE).

</page>

<page url="/en/docs/react/migration/agent-index">
# Migration (for AI assistants)

**Category**: react
**URL**: https://www.heroui.com/en/docs/react/migration/agent-index
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/migration/agent-index.mdx
> Entry point for AI assistants helping migrate HeroUI v2 to v3


For AI assistants: use this as the entry point when helping migrate HeroUI v2 → v3.

## Entry

Choose a migration strategy:

* **Full migration** (project will be broken during migration) → read `(workflows)/agent-guide-full.mdx`.
* **Incremental** (v2 and v3 coexist) → read `(workflows)/agent-guide-incremental.mdx`.

## Reference in this bundle

* **Cross-cutting guides:** `hooks.mdx`, `styling.mdx`.
* The workflow guides above already inline the "major changes", "key API changes", component reference table, and "new components" sections.
* **Per-component guides:** `(components)/<component>.mdx` (e.g. `(components)/button.mdx`, `(components)/select.mdx`). Use the component reference table in the workflow guides to find the right file.

</page>

<page url="/en/docs/react/migration/hooks">
# Hooks

**Category**: react
**URL**: https://www.heroui.com/en/docs/react/migration/hooks
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/migration/hooks.mdx
> Migration guide for HeroUI hooks from v2 to v3


<Callout type="info">
  Refer to the [v3 component documentation](/docs/components-list) for complete API reference. This guide focuses on migrating hooks from HeroUI v2.
</Callout>

## Overview

HeroUI v3 removes most component hooks that existed in v2, replacing them with compound components and a new hook for overlay state management. This guide covers:

* Component hooks removal (useSwitch, useInput, useCheckbox, etc.)
* useDisclosure → useOverlayState migration
* Migration strategies and examples

## Component Hooks Removal

HeroUI v2 provided component hooks (like `useSwitch`, `useInput`, `useCheckbox`, etc.) that returned prop getters (`getBaseProps`, `getWrapperProps`, `getThumbProps`, etc.) to customize component structure when users couldn't directly modify inner child components. HeroUI v3 solves this with compound components, eliminating the need for hooks.

### Why Hooks Existed in v2

In v2, components had fixed internal structures. To customize these structures, users needed to use hooks that provided prop getters. For example, `useSwitch` returned `getBaseProps()`, `getWrapperProps()`, `getThumbProps()`, etc., which users could spread onto custom elements to build their own Switch structure.

### v3 Solution: Compound Components

v3 uses compound component patterns that give you direct access to component parts. Instead of using hooks with prop getters, you compose components directly using subcomponents like `Switch.Control`, `Switch.Thumb`, `Checkbox.Control`, `Checkbox.Indicator`, etc.

### Migration Strategy

1. **Identify hook usage**: Search your codebase for imports from `@heroui/react` that include hook names (`useSwitch`, `useInput`, `useCheckbox`, `useRadio`, etc.)
2. **Replace with compound components**: Instead of using hooks with prop getters, use the compound component pattern
3. **Preserve original structure**: When migrating, try to keep the same component structure you had with hooks. For example:
   * If you used `useSwitch` to create a switch **without** a thumb, don't add `Switch.Thumb` in v3
   * If you used `useCheckbox` to create a checkbox **without** an indicator, don't add `Checkbox.Indicator` in v3
   * Only include the subcomponents that were actually used in your hook-based implementation
4. **Reference component guides**: Check individual component migration guides for specific examples

### Key Differences

* **v2**: Hooks provided prop getters to customize fixed component structures
* **v3**: Compound components allow direct composition of component parts

### Preserving Structure Example

**v2: Switch without thumb**

```tsx
import { useSwitch } from "@heroui/react";

function CustomSwitch() {
  const { getBaseProps } = useSwitch();
  
  return (
    <div {...getBaseProps()}>
      {/* No thumb element */}
    </div>
  );
}

```

**v3: Equivalent structure**

```tsx
import { Switch } from "@heroui/react";

function CustomSwitch() {
  return (
    <Switch.Control>
      {/* No Switch.Thumb - preserving the original structure */}
    </Switch.Control>
  );
}

```

For detailed migration examples for specific components, see the individual component migration guides.

## useDisclosure → useOverlayState

The `useDisclosure` hook from v2 has been replaced with `useOverlayState` in v3. This hook manages open/close state for modals, popovers, and other overlay components.

### v2: useDisclosure

**API:**

```tsx
const {isOpen, onOpen, onClose, onOpenChange, isControlled, getButtonProps, getDisclosureProps} = useDisclosure({
  isOpen?: boolean;
  defaultOpen?: boolean;
  onClose?(): void;
  onOpen?(): void;
  onChange?(isOpen: boolean | undefined): void;
  id?: string;
});

```

**Example:**

```tsx
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure } from "@heroui/react";

export default function App() {
  const {isOpen, onOpen, onOpenChange} = useDisclosure();

  return (
    <>
      <Button onPress={onOpen}>Open Modal</Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalHeader>Title</ModalHeader>
          <ModalBody>Content</ModalBody>
          <ModalFooter>
            <Button onPress={onOpenChange}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

```

### v3: useOverlayState

**API:**

```tsx
const state = useOverlayState({
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
});

// Returns:
// {
//   isOpen: boolean;
//   open(): void;
//   close(): void;
//   toggle(): void;
//   setOpen(isOpen: boolean): void;
// }

```

**Example:**

```tsx
import { Modal, Button, useOverlayState } from "@heroui/react";

export default function App() {
  const state = useOverlayState();

  return (
    <Modal>
      <Button onPress={state.open}>Open Modal</Button>
      <Modal.Container isOpen={state.isOpen} onOpenChange={state.setOpen}>
        <Modal.Dialog>
          {({close}) => (
            <>
              <Modal.Header>
                <Modal.Heading>Title</Modal.Heading>
              </Modal.Header>
              <Modal.Body>Content</Modal.Body>
              <Modal.Footer>
                <Button onPress={close}>Close</Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}

```

### Migration Guide

#### Basic Migration

**v2:**

```tsx
const {isOpen, onOpen, onClose, onOpenChange} = useDisclosure();

```

**v3:**

```tsx
const state = useOverlayState();
// Use state.open(), state.close(), state.toggle(), state.setOpen(boolean)

```

#### Controlled State

**v2:**

```tsx
const {isOpen, onOpenChange} = useDisclosure({
  isOpen: controlledIsOpen,
  onChange: (isOpen) => setControlledIsOpen(isOpen)
});

```

**v3:**

```tsx
const state = useOverlayState({
  isOpen: controlledIsOpen,
  onOpenChange: setControlledIsOpen
});

```

#### Uncontrolled State

**v2:**

```tsx
const {isOpen, onOpen, onClose} = useDisclosure({
  defaultOpen: false
});

```

**v3:**

```tsx
const state = useOverlayState({
  defaultOpen: false
});
// Use state.open(), state.close(), state.toggle()

```

### API Differences

| v2 (useDisclosure)     | v3 (useOverlayState) | Notes                             |
| ---------------------- | -------------------- | --------------------------------- |
| `isOpen`               | `isOpen`             | Same                              |
| `onOpen()`             | `open()`             | Renamed method                    |
| `onClose()`            | `close()`            | Renamed method                    |
| `onOpenChange()`       | `toggle()`           | New method for toggling           |
| `onOpenChange` (prop)  | `setOpen(boolean)`   | Different API                     |
| `isControlled`         | -                    | Removed (handled internally)      |
| `getButtonProps()`     | -                    | Removed (use compound components) |
| `getDisclosureProps()` | -                    | Removed (use compound components) |

### Benefits of useOverlayState

* **Cleaner API**: Dedicated methods (`open()`, `close()`, `toggle()`) instead of callbacks
* **Simpler state management**: Works seamlessly with both controlled and uncontrolled patterns
* **Better TypeScript support**: Improved type inference and autocomplete
* **Consistent with React Aria**: Aligns with React Aria Components patterns

### Alternative: useState

For simple cases, you can also use React's `useState` directly:

```tsx
import { useState } from "react";
import { Modal, Button } from "@heroui/react";

export default function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Modal>
      <Button onPress={() => setIsOpen(true)}>Open</Button>
      <Modal.Container isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Dialog>
          {/* content */}
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}

```

However, `useOverlayState` provides a cleaner API with dedicated methods for common operations.

## Removed Hooks

The following hooks from v2 have been removed in v3:

* **useDraggable**: Removed
* **useClipboard**: Removed
* **usePagination**: Removed
* **useToast**: Removed

## Summary

* **Component hooks** (`useSwitch`, `useInput`, etc.) → Use **compound components** instead
* **useDisclosure** → Use **useOverlayState** for overlay state management
* **useOverlayState** provides a cleaner API with `open()`, `close()`, `toggle()`, and `setOpen()` methods
* **Removed hooks**: `useDraggable`, `useClipboard`, `usePagination`, `useToast` are no longer available
* For simple cases, `useState` can be used directly, but `useOverlayState` offers better ergonomics

For component-specific hook migration examples, refer to the individual component migration guides.

</page>

<page url="/en/docs/react/migration">
# Migration

**Category**: react
**URL**: https://www.heroui.com/en/docs/react/migration
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/migration/index.mdx
> Complete guide to migrate your HeroUI v2 application to v3


## For AI Assistants

Below are three approaches for AI assistants to access migration documentation. ***We recommend using the HeroUI Migration MCP server*** and leveraging its prompts and tools, but all options provide agents with the complete documentation.

| Feature           | MCP Server                                       | Agent Skills                                         | AGENTS.md                                      |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------- |
| **Data source**   | Remote endpoints                                 | Remote endpoints                                     | Local files                                    |
| **Access method** | MCP tools                                        | Script files                                         | Local file reads                               |
| **Setup**         | MCP config                                       | Install command                                      | `heroui-cli` command                           |
| **Updates**       | Real-time                                        | Real-time                                            | Manual                                         |
| **Offline**       | ❌                                                | ❌                                                    | ✅                                              |
| **Tools**         | MCP tools + prompts                              | Scripts                                              | ❌                                              |
| **Guide**         | [MCP Server →](/docs/react/migration/mcp-server) | [Agent Skills →](/docs/react/migration/agent-skills) | [AGENTS.md →](/docs/react/migration/agents-md) |

## Major Changes

<section id="major-changes">
  * **Dependencies**: Update React to v19+, HeroUI packages to v3, Tailwind CSS to v4, remove Framer Motion
  * **No Provider Required**: v3 removes the need for `HeroUIProvider`
  * **Component API Updates**: Many components use React Aria Components patterns
  * **Compound Components**: New compound component patterns for better customization. See individual component guides for details.
  * **Hooks Removed**: v2 component hooks like `useSwitch` or `useInput` are removed - use compound components instead. `useDisclosure` is replaced with `useOverlayState`. See the [Hooks Migration Guide](/docs/react/migration/hooks) for details.
  * **Configuration**: Remove `heroui()` plugin from Tailwind config, update CSS imports, remove `hero.ts` file
  * **Item identity**: Collection items (Dropdown, Listbox, Select, Accordion, etc.) now use `id` and `textValue` in v3; keep React's `key` for lists.
</section>

### Item identity and accessibility (key, id, textValue)

In v2, collection components (Dropdown, Listbox, Select, Accordion, etc.) used **React's `key`** as the item identity. The same value drove both React's list reconciliation and the component's selection/expand state. In v3, which uses React Aria Components, those roles are split:

* **`id`** — v3 uses an explicit **`id`** prop on each item for selection state, focus, and callbacks (e.g. `selectedKeys`, `expandedKeys`, `onSelectionChange`). Use the same (or equivalent) value you used for `key` in v2 so that state and callbacks continue to refer to the correct item.
* **`textValue`** — v3 requires **`textValue`** on items when the visible content is not plain text (e.g. when using `Label`, icons, or `Description`). It is used for screen reader announcements and type-ahead.
* **`key`** — **Keep using React's `key`** on list items. It is still required for React's reconciliation and is independent of `id`.

When migrating: add `id` (and `textValue` where needed) for v3's API, but keep `key` for React.

## Migration Strategies

HeroUI v2 and v3 cannot coexist in the same project without special setup. You have two migration approaches to choose from:

### Full Migration

**Best for:** Projects that can dedicate focused time to complete migration in one go.

**How it works:**

* Migrate all component code first (project will be broken during this phase)
* Switch dependencies to v3
* Complete styling migration

**Advantages:**

* Simpler setup - no complex coexistence configuration
* Cleaner transition - only one version active at a time
* Supported by Migration MCP prompts

**Disadvantages:**

* Project is broken during migration
* All components should be migrated before switching dependencies

**Get started:** [Full Migration Guide](/docs/react/migration/full-migration)

### Incremental Migration

**Best for:** Projects that need to stay functional during migration, teams migrating gradually over time, large codebases migrating feature-by-feature.

**How it works:**

* Set up coexistence using pnpm aliases or component packages
* Migrate components one-by-one while keeping project functional
* Complete migration and remove v2 dependencies

**Advantages:**

* Project remains functional during migration
* Can migrate gradually over time
* Can test v3 components alongside v2

**Disadvantages:**

* More complex initial setup
* Potential styling conflicts
* Requires managing two versions simultaneously

**Get started:** [Incremental Migration Guide](/docs/react/migration/incremental-migration)

## Component Migration Reference

<section id="step-6-component-migration-reference">
  Use the table below to quickly find migration guidance for each component. Use the link in the "Migration Guide" column to jump to detailed migration instructions.

  <Callout>
    **Component Development Status**: Components marked with 🔄 In Progress or 📋 Planned are still being developed. Check the [Roadmap](https://herouiv3.featurebase.app/roadmap) for the task status. Guides for these components will be available once development is finished.
  </Callout>

  | v2 Component     | v3 Component                 | Status      | Migration Guide                                                           |
  | ---------------- | ---------------------------- | ----------- | ------------------------------------------------------------------------- |
  | Accordion        | Accordion                    | ✅ Available | [View guide →](/docs/react/migration/accordion)                           |
  | Alert            | Alert                        | ✅ Available | [View guide →](/docs/react/migration/alert)                               |
  | Autocomplete     | ComboBox                     | ✅ Renamed   | [View guide →](/docs/react/migration/autocomplete)                        |
  | Avatar           | Avatar                       | ✅ Available | [View guide →](/docs/react/migration/avatar)                              |
  | Badge            | Badge                        | ✅ Available | [View guide →](/docs/react/migration/badge)                               |
  | Breadcrumbs      | Breadcrumbs                  | ✅ Available | [View guide →](/docs/react/migration/breadcrumbs)                         |
  | Button           | Button                       | ✅ Available | [View guide →](/docs/react/migration/button)                              |
  | ButtonGroup      | ButtonGroup                  | ✅ Available | [View guide →](/docs/react/migration/button-group)                        |
  | Calendar         | Calendar                     | ✅ Available | [View guide →](/docs/react/migration/calendar)                            |
  | Card             | Card                         | ✅ Available | [View guide →](/docs/react/migration/card)                                |
  | Checkbox         | Checkbox                     | ✅ Available | [View guide →](/docs/react/migration/checkbox)                            |
  | CheckboxGroup    | CheckboxGroup                | ✅ Available | [View guide →](/docs/react/migration/checkbox-group)                      |
  | Chip             | Chip                         | ✅ Available | [View guide →](/docs/react/migration/chip)                                |
  | Code             | ❌                            | ❌ Removed   | [View guide →](/docs/react/migration/code)                                |
  | DateInput        | DateField                    | ✅ Renamed   | [View guide →](/docs/react/migration/dateinput)                           |
  | DatePicker       | DatePicker                   | ✅ Available | [View guide →](/docs/react/migration/date-picker)                         |
  | DateRangePicker  | DateRangePicker              | ✅ Available | [View guide →](/docs/react/migration/date-range-picker)                   |
  | TimeInput        | TimeField                    | ✅ Renamed   | [View guide →](/docs/react/migration/timeinput)                           |
  | Divider          | Separator                    | ✅ Renamed   | [View guide →](/docs/react/migration/divider)                             |
  | Drawer           | Drawer                       | ✅ Available | [View guide →](/docs/react/migration/drawer)                              |
  | Dropdown         | Dropdown                     | ✅ Available | [View guide →](/docs/react/migration/dropdown)                            |
  | Form             | Form                         | ✅ Available | [View guide →](/docs/react/migration/form)                                |
  | Image            | ❌                            | ❌ Removed   | [View guide →](/docs/react/migration/image)                               |
  | Input            | TextField, Input, InputGroup | ✅ Available | [View guide →](/docs/react/migration/input)                               |
  | InputOTP         | InputOTP                     | ✅ Available | [View guide →](/docs/react/migration/input-otp)                           |
  | Kbd              | Kbd                          | ✅ Available | [View guide →](/docs/react/migration/kbd)                                 |
  | Link             | Link                         | ✅ Available | [View guide →](/docs/react/migration/link)                                |
  | Listbox          | ListBox                      | ✅ Available | [View guide →](/docs/react/migration/listbox)                             |
  | Modal            | Modal                        | ✅ Available | [View guide →](/docs/react/migration/modal)                               |
  | Navbar           | ❌                            | ❌ Removed   | [View guide →](/docs/react/migration/navbar)                              |
  | NumberInput      | NumberField                  | ✅ Renamed   | [View guide →](/docs/react/migration/numberinput)                         |
  | Pagination       | Pagination                   | ✅ Available | [View guide →](/docs/react/migration/pagination)                          |
  | Popover          | Popover                      | ✅ Available | [View guide →](/docs/react/migration/popover)                             |
  | Progress         | ProgressBar                  | ✅ Renamed   | [View guide →](/docs/react/migration/progress)                            |
  | CircularProgress | ProgressCircle               | ✅ Renamed   | [View guide →](/docs/react/migration/circular-progress)                   |
  | Radio            | Radio                        | ✅ Available | [View guide →](/docs/react/migration/radio)                               |
  | RadioGroup       | RadioGroup                   | ✅ Available | [View guide →](/docs/react/migration/radio-group)                         |
  | RangeCalendar    | RangeCalendar                | ✅ Available | [View guide →](/docs/react/migration/range-calendar)                      |
  | Ripple           | ❌                            | ❌ Removed   | [See Button ripple →](/docs/react/components/button#adding-ripple-effect) |
  | ScrollShadow     | ScrollShadow                 | ✅ Available | [View guide →](/docs/react/migration/scroll-shadow)                       |
  | Select           | Select                       | ✅ Available | [View guide →](/docs/react/migration/select)                              |
  | Skeleton         | Skeleton                     | ✅ Available | [View guide →](/docs/react/migration/skeleton)                            |
  | Slider           | Slider                       | ✅ Available | [View guide →](/docs/react/migration/slider)                              |
  | Snippet          | ❌                            | ❌ Removed   | [View guide →](/docs/react/migration/snippet)                             |
  | Spacer           | ❌                            | ❌ Removed   | [View guide →](/docs/react/migration/spacer)                              |
  | Spinner          | Spinner                      | ✅ Available | [View guide →](/docs/react/migration/spinner)                             |
  | Switch           | Switch                       | ✅ Available | [View guide →](/docs/react/migration/switch)                              |
  | Table            | Table                        | ✅ Available | [View guide →](/docs/react/migration/table)                               |
  | Tabs             | Tabs                         | ✅ Available | [View guide →](/docs/react/migration/tabs)                                |
  | Toast            | Toast                        | ✅ Available | [View guide →](/docs/react/migration/toast)                               |
  | Tooltip          | Tooltip                      | ✅ Available | [View guide →](/docs/react/migration/tooltip)                             |
  | User             | ❌                            | ❌ Removed   | [View guide →](/docs/react/migration/user)                                |
</section>

## New Components in v3

<section id="new-components-in-v3">
  v3 introduces a number of new components not available in v2:

  | Component       | Purpose                                                                              | Documentation                                          |
  | --------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
  | TextField       | Enhanced text input with label and description support                               | [View docs →](/docs/react/components/text-field)       |
  | TextArea        | Multi-line text input component                                                      | [View docs →](/docs/react/components/text-area)        |
  | AlertDialog     | Modal dialog for confirmations and alerts                                            | [View docs →](/docs/react/components/alert-dialog)     |
  | Label           | Accessible form label component                                                      | [View docs →](/docs/react/components/label)            |
  | Description     | Helper text for form fields                                                          | [View docs →](/docs/react/components/description)      |
  | FieldError      | Form field error message display                                                     | [View docs →](/docs/react/components/field-error)      |
  | Fieldset        | Group related form fields                                                            | [View docs →](/docs/react/components/fieldset)         |
  | InputGroup      | Compose multiple inputs together                                                     | [View docs →](/docs/react/components/input-group)      |
  | Surface         | Container component with elevation styles                                            | [View docs →](/docs/react/components/surface)          |
  | Disclosure      | Expandable/collapsible content sections                                              | [View docs →](/docs/react/components/disclosure)       |
  | DisclosureGroup | Compound component for multiple disclosure sections                                  | [View docs →](/docs/react/components/disclosure-group) |
  | SearchField     | Search input with clear button and optional loading state                            | [View docs →](/docs/react/components/search-field)     |
  | DateField       | Date input with calendar picker                                                      | [View docs →](/docs/react/components/date-field)       |
  | TimeField       | Time input component                                                                 | [View docs →](/docs/react/components/time-field)       |
  | Tag, TagGroup   | Tags and tag group for selection or display                                          | [View docs →](/docs/react/components/tag-group)        |
  | ColorPicker     | Color selection (ColorArea, ColorField, ColorSlider, ColorSwatch, ColorSwatchPicker) | [View docs →](/docs/react/components/color-picker)     |
  | CloseButton     | Dismiss or close trigger button                                                      | [View docs →](/docs/react/components/close-button)     |
  | ErrorMessage    | Form field error display (React Aria integration)                                    | [View docs →](/docs/react/components/error-message)    |
</section>

## Additional Migration Guides

* **[Hooks Migration Guide](/docs/react/migration/hooks)**: Detailed guide for migrating hooks from v2 to v3
* **[Styling Migration Guide](/docs/react/migration/styling)**: Comprehensive guide for updating utility classes, color tokens, and component styling

## Getting Help

If you encounter issues during migration:

1. Check the [v3 documentation](/docs/react)
2. Review component-specific migration guides
3. Check the [GitHub Discussions](https://github.com/heroui-inc/heroui/discussions)
4. Join the [Discord community](https://discord.gg/9b6yyZKmH4)

</page>

<page url="/en/docs/react/migration/styling">
# Styling & Theming

**Category**: react
**URL**: https://www.heroui.com/en/docs/react/migration/styling
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/migration/styling.mdx
> Complete guide to styling changes and theming system migration from HeroUI v2 to v3


<Callout type="info">
  This guide covers all styling-related changes between HeroUI v2 and v3, including utility classes, component styles, theme system architecture, and visual differences. For component-specific API changes, see individual component migration guides.
</Callout>

**Note:** The `classNames` prop has been replaced with `className` prop in v3. All components now use the standard React `className` prop instead of the `classNames` object prop from v2.

## Overview

HeroUI v3 introduces significant changes to the styling system:

* **CSS-First Architecture**: Replaces Tailwind plugin with pure CSS files
* **Standard Tailwind Utilities**: Custom utilities replaced with standard Tailwind classes
* **CSS Variables**: New CSS variable naming and structure
* **Component Styles**: Updated default sizes, spacing, and visual appearance
* **No Plugin Required**: Removed dependency on Tailwind plugin configuration
* **Color System Overhaul**: Semantic colors reorganized (`primary` → `accent`, `secondary` removed, numbered scales removed)
* **Content Colors Removed**: `content1-4` replaced with `surface` and `overlay` system

## Quick Reference

### Utility Classes Mapping

| v2 Utility                   | v3 Equivalent                | Notes                                           |
| ---------------------------- | ---------------------------- | ----------------------------------------------- |
| `text-tiny`                  | `text-xs`                    | Font size: 0.75rem → 0.75rem (same)             |
| `text-small`                 | `text-sm`                    | Font size: 0.875rem → 0.875rem (same)           |
| `text-medium`                | `text-base`                  | Font size: 1rem → 1rem (same)                   |
| `text-large`                 | `text-lg`                    | Font size: 1.125rem → 1.125rem (same)           |
| `rounded-small`              | `rounded-sm`                 | Border radius: 8px → 4px (different)            |
| `rounded-medium`             | `rounded-md`                 | Border radius: 12px → 6px (different)           |
| `rounded-large`              | `rounded-lg`                 | Border radius: 14px → 8px (different)           |
| `border-small`               | `border`                     | Border width: 1px → 1px (use standard Tailwind) |
| `border-medium`              | `border-2`                   | Border width: 2px → 2px (use standard Tailwind) |
| `border-large`               | `border-[3px]`               | Border width: 3px → 3px (use arbitrary value)   |
| `bg-content1`                | `bg-surface` or `bg-overlay` | Content color removed, use surface/overlay      |
| `bg-content2`                | `bg-surface-secondary`       | Content color removed, use surface level        |
| `bg-primary`                 | `bg-accent`                  | Primary renamed to accent                       |
| `bg-secondary`               | `bg-default`                 | Secondary color removed, use default            |
| `bg-primary-50`              | `bg-accent-soft`             | Numbered scales removed                         |
| `bg-primary-100`             | `bg-accent-soft`             | Numbered scales removed                         |
| `text-primary-600`           | `text-accent`                | Numbered scales removed                         |
| `.transition-background`     | Standard CSS transitions     | Removed utility                                 |
| `.transition-colors-opacity` | Standard CSS transitions     | Removed utility                                 |

## Utility Classes Migration

### Text Utilities

HeroUI v2 provided custom text size utilities that mapped to CSS variables. v3 uses standard Tailwind text size classes.

**v2 Text Utilities:**

```tsx
// v2 - Custom utilities with CSS variables
<div className="text-tiny">Tiny text</div>
<div className="text-small">Small text</div>
<div className="text-medium">Medium text</div>
<div className="text-large">Large text</div>

```

**v3 Text Utilities:**

```tsx
// v3 - Standard Tailwind classes
<div className="text-xs">Tiny text</div>
<div className="text-sm">Small text</div>
<div className="text-base">Medium text</div>
<div className="text-lg">Large text</div>

```

**Mapping Details:**

| v2 Class      | Font Size       | Line Height    | v3 Class    | Font Size       | Line Height    |
| ------------- | --------------- | -------------- | ----------- | --------------- | -------------- |
| `text-tiny`   | 0.75rem (12px)  | 1rem (16px)    | `text-xs`   | 0.75rem (12px)  | 1rem (16px)    |
| `text-small`  | 0.875rem (14px) | 1.25rem (20px) | `text-sm`   | 0.875rem (14px) | 1.25rem (20px) |
| `text-medium` | 1rem (16px)     | 1.5rem (24px)  | `text-base` | 1rem (16px)     | 1.5rem (24px)  |
| `text-large`  | 1.125rem (18px) | 1.75rem (28px) | `text-lg`   | 1.125rem (18px) | 1.75rem (28px) |

### Border Radius Utilities

v2 used custom border radius utilities (`rounded-small`, `rounded-medium`, `rounded-large`) that mapped to CSS variables. v3 uses standard Tailwind border radius classes, but the actual values differ.

**v2 Border Radius:**

```tsx
// v2 - Custom utilities
<div className="rounded-small">Small radius</div>
<div className="rounded-medium">Medium radius</div>
<div className="rounded-large">Large radius</div>

```

**v3 Border Radius:**

```tsx
// v3 - Standard Tailwind classes
<div className="rounded-sm">Small radius</div>
<div className="rounded-md">Medium radius</div>
<div className="rounded-lg">Large radius</div>

```

**Value Comparison:**

| v2 Class         | v2 Value        | v3 Class     | v3 Value       | Difference |
| ---------------- | --------------- | ------------ | -------------- | ---------- |
| `rounded-small`  | 8px (0.5rem)    | `rounded-sm` | 4px (0.25rem)  | Smaller    |
| `rounded-medium` | 12px (0.75rem)  | `rounded-md` | 6px (0.375rem) | Smaller    |
| `rounded-large`  | 14px (0.875rem) | `rounded-lg` | 8px (0.5rem)   | Smaller    |

**Note:** v3 uses smaller default border radius values. If you need the exact v2 values, use arbitrary values:

```tsx
// Match v2 rounded-small (8px)
<div className="rounded-[8px]">Custom radius</div>

// Match v2 rounded-medium (12px)
<div className="rounded-[12px]">Custom radius</div>

// Match v2 rounded-large (14px)
<div className="rounded-[14px]">Custom radius</div>

```

### Border Width Utilities

v2 provided custom border width utilities (`border-small`, `border-medium`, `border-large`). v3 uses standard Tailwind border width classes.

**v2 Border Width:**

```tsx
// v2 - Custom utilities
<div className="border-small border-default">1px border</div>
<div className="border-medium border-primary">2px border</div>
<div className="border-large border-danger">3px border</div>

```

**v3 Border Width:**

```tsx
// v3 - Standard Tailwind classes
<div className="border border-default">1px border</div>
<div className="border-2 border-accent">2px border</div>
<div className="border-[3px] border-danger">3px border</div>

```

**Mapping:**

| v2 Class        | Width | v3 Class       | Width           |
| --------------- | ----- | -------------- | --------------- |
| `border-small`  | 1px   | `border`       | 1px             |
| `border-medium` | 2px   | `border-2`     | 2px             |
| `border-large`  | 3px   | `border-[3px]` | 3px (arbitrary) |

### Transition Utilities

v2 provided custom transition utilities for common animation patterns with a default duration of 250ms. v3 removes these utilities in favor of standard Tailwind `transition-*` utilities, where you specify which properties to transition.

**v2 Transition Utilities:**

v2 provided custom transition utilities with a default duration of 250ms and `ease` timing function. The following table shows which CSS properties each utility transitions:

| v2 Utility                             | Transition Properties                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `.transition-background`               | `background`                                                                                                        |
| `.transition-colors-opacity`           | `color, background-color, border-color, text-decoration-color, fill, stroke, opacity`                               |
| `.transition-width`                    | `width`                                                                                                             |
| `.transition-height`                   | `height`                                                                                                            |
| `.transition-size`                     | `width, height`                                                                                                     |
| `.transition-left`                     | `left`                                                                                                              |
| `.transition-transform-opacity`        | `transform, scale, opacity rotate`                                                                                  |
| `.transition-transform-background`     | `transform, scale, background`                                                                                      |
| `.transition-transform-colors`         | `transform, scale, color, background, background-color, border-color, text-decoration-color, fill, stroke`          |
| `.transition-transform-colors-opacity` | `transform, scale, color, background, background-color, border-color, text-decoration-color, fill, stroke, opacity` |

**Note:** These utilities are no longer available in v3. Use Tailwind's standard `transition-*` utilities to specify which properties to transition.

### Other Utilities

**Scrollbar Utilities:**

v2 provided `.scrollbar-hide` and `.scrollbar-default` utilities. v3 now exposes standards-only scrollbar utilities from `@heroui/styles`: `scrollbar`, `scrollbar-thin`, `scrollbar-default`, and `scrollbar-none`. Use `data-scrollbar="thin"`, `data-scrollbar="default"`, or `data-scrollbar="none"` on an ancestor for subtree-level control.

**Animation Utilities:**

v2 provided spinner animation utilities (`.spinner-bar-animation`, `.spinner-dot-animation`, etc.). These are handled internally by v3 components and are not exposed as utilities.

**Custom Utilities:**

v2 included utilities like:

* `.leading-inherit` → Use `leading-[inherit]`
* `.tap-highlight-transparent` → Use `[-webkit-tap-highlight-color:transparent]`
* `.input-search-cancel-button-none` → Use custom CSS if needed

## Theme System Architecture

### v2: Plugin-Based System

v2 used a Tailwind CSS plugin that:

1. **Generated Utilities**: Created custom utility classes via JavaScript
2. **CSS Variables**: Injected CSS variables through the plugin
3. **Theme Configuration**: Required configuration in `tailwind.config.js`
4. **Runtime Generation**: Utilities generated at build time

**v2 Configuration:**

```js
// tailwind.config.js
const {heroui} = require("@heroui/react");

module.exports = {
  plugins: [
    heroui({
      layout: {
        fontSize: {
          tiny: "0.75rem",
          small: "0.875rem",
          medium: "1rem",
          large: "1.125rem",
        },
        radius: {
          small: "8px",
          medium: "12px",
          large: "14px",
        },
      },
      themes: {
        light: {
          colors: {
            primary: {
              // color definitions
            },
          },
        },
      },
    }),
  ],
};

```

### v3: CSS-First System

v3 uses a pure CSS approach:

1. **CSS Files**: Styles defined in CSS files (`packages/styles/`)
2. **CSS Variables**: Variables defined in CSS, not generated
3. **No Plugin**: No Tailwind plugin required
4. **Import-Based**: Styles imported via CSS imports

**v3 Configuration:**

```css
/* globals.css */
@import "tailwindcss";
@import "@heroui/styles";

```

**No Tailwind Config Required:**

If you only use HeroUI, you can remove `tailwind.config.js` entirely. If you have custom Tailwind config, keep it but remove the HeroUI plugin.

### Architecture Comparison

| Aspect                 | v2                           | v3                     |
| ---------------------- | ---------------------------- | ---------------------- |
| **Styling Method**     | Tailwind plugin (JavaScript) | CSS files              |
| **Utility Generation** | Runtime via plugin           | Pre-defined CSS        |
| **CSS Variables**      | Generated by plugin          | Defined in CSS         |
| **Configuration**      | `tailwind.config.js`         | CSS imports            |
| **Customization**      | Plugin config                | CSS variable overrides |
| **Build Dependency**   | Requires plugin              | No plugin needed       |

## CSS Variables & Design Tokens

### Variable Naming Changes

v2 used the pattern `--heroui-{property}-{scale}` while v3 uses `--{property}` or `--color-{property}`.

**v2 CSS Variables:**

```css
--heroui-font-size-tiny: 0.75rem;
--heroui-font-size-small: 0.875rem;
--heroui-radius-small: 8px;
--heroui-radius-medium: 12px;
--heroui-border-width-medium: 2px;
--heroui-disabled-opacity: 0.5;

```

**v3 CSS Variables:**

```css
/* Typography - handled by Tailwind */
/* No custom font-size variables */

/* Radius */
--radius-xs: calc(var(--radius) * 0.25);
--radius-sm: calc(var(--radius) * 0.5);
--radius-md: calc(var(--radius) * 0.75);
--radius-lg: calc(var(--radius) * 1);
--radius-xl: calc(var(--radius) * 1.5);

/* Colors */
--color-background: var(--background);
--color-foreground: var(--foreground);
--color-accent: var(--accent);
--color-muted: var(--muted);

/* Opacity */
--disabled-opacity: 0.5;

```

### Color System Changes

**v2 Color Structure:**

```css
--heroui-primary: 210 100% 50%;
--heroui-primary-50: 210 100% 95%;
--heroui-primary-100: 210 100% 90%;
/* ... more shades ... */

```

**v3 Color Structure:**

```css
--accent: oklch(0.6204 0.195 253.83);
--accent-foreground: var(--snow);
--accent-hover: color-mix(in oklab, var(--accent) 90%, var(--accent-foreground) 10%);

```

**Key Differences:**

1. **Color Format**: v2 used HSL, v3 uses OKLCH
2. **Naming**: v2 used numbered shades (50-900), v3 uses semantic names
3. **Calculated Colors**: v3 uses `color-mix()` for hover states
4. **Foreground Colors**: v3 explicitly defines foreground colors
5. **Primary → Accent**: `primary` color renamed to `accent`
6. **Secondary Color Removed**: `secondary` semantic color removed (was purple in v2)
7. **Numbered Scales Removed**: Color scales like `primary-50`, `primary-100`, etc. no longer exist

### Primary → Accent Rename

v2 used `primary` as the main brand color. v3 renamed it to `accent` for better semantic clarity.

**v2 Primary Color:**

```tsx
// v2 - Primary color with numbered scales
<Button color="primary">Primary Button</Button>
<div className="bg-primary">Primary background</div>
<div className="bg-primary-50">Light primary</div>
<div className="bg-primary-100">Lighter primary</div>
<div className="text-primary-600">Primary text</div>

```

**v3 Accent Color:**

```tsx
// v3 - Accent color (no numbered scales)
<Button variant="primary">Primary Button</Button>
<div className="bg-accent">Accent background</div>
<div className="bg-accent-soft">Soft accent</div>
<div className="text-accent">Accent text</div>

```

**Migration:**

| v2 Class           | v3 Equivalent    | Notes                |
| ------------------ | ---------------- | -------------------- |
| `bg-primary`       | `bg-accent`      | Base accent color    |
| `text-primary`     | `text-accent`    | Accent text color    |
| `bg-primary-50`    | `bg-accent-soft` | Light accent variant |
| `bg-primary-100`   | `bg-accent-soft` | Light accent variant |
| `bg-primary-500`   | `bg-accent`      | Base accent color    |
| `text-primary-600` | `text-accent`    | Accent text color    |
| `border-primary`   | `border-accent`  | Accent border        |

**Note:** v3 doesn't have numbered color scales (`-50`, `-100`, `-200`, etc.). Use semantic variants like `-soft`, `-hover`, or custom Tailwind classes.

### Secondary Color Removed

v2 provided a `secondary` semantic color (purple). This has been removed in v3. Component variants named "secondary" now use different colors.

**v2 Secondary Color:**

```tsx
// v2 - Secondary as a semantic color (purple)
<Button color="secondary">Secondary Button</Button>
<div className="bg-secondary">Secondary background</div>
<div className="bg-secondary-50">Light secondary</div>
<div className="text-secondary-600">Secondary text</div>

```

**v3 Secondary Variant:**

```tsx
// v3 - Secondary is a variant, not a color
<Button variant="secondary">Secondary Button</Button>
<div className="bg-default">Default background (used by secondary variant)</div>
<div className="text-accent">Accent text</div>

```

**Migration:**

| v2 Class           | v3 Equivalent   | Notes                                |
| ------------------ | --------------- | ------------------------------------ |
| `bg-secondary`     | `bg-default`    | Secondary variant uses default color |
| `text-secondary`   | `text-accent`   | Use accent for emphasis              |
| `bg-secondary-50`  | `bg-default`    | Use default color                    |
| `border-secondary` | `border-accent` | Use accent border                    |

**Note:** In v3, "secondary" refers to a component variant style (like `button--secondary`), not a color token. The secondary variant typically uses `bg-default` and `text-accent-soft-foreground`.

### Numbered Color Scales Removed

v2 provided numbered color scales (50-900) for all semantic colors. v3 removed these in favor of semantic variants and calculated colors.

**v2 Numbered Scales:**

```tsx
// v2 - Numbered color scales
<div className="bg-primary-50">Lightest</div>
<div className="bg-primary-100">Lighter</div>
<div className="bg-primary-200">Light</div>
<div className="bg-primary-500">Base</div>
<div className="bg-primary-600">Dark</div>
<div className="bg-primary-900">Darkest</div>

```

**v3 Semantic Variants:**

```tsx
// v3 - Semantic variants and calculated colors
<div className="bg-accent-soft">Soft variant</div>
<div className="bg-accent">Base color</div>
<div className="bg-accent-hover">Hover state</div>

```

**Migration:**

* **Light shades** (`-50`, `-100`, `-200`): Use `-soft` variants or custom Tailwind opacity classes
* **Base color** (`-500`): Use base color name (`bg-accent`, `bg-danger`, etc.)
* **Dark shades** (`-600`, `-700`, `-800`, `-900`): Use hover variants or custom Tailwind classes

### Content Colors Removed

v2 provided `content1`, `content2`, `content3`, and `content4` colors for layered backgrounds. These have been removed in v3 and replaced with semantic surface colors.

**v2 Content Colors:**

```tsx
// v2 - Content colors for layered backgrounds
<div className="bg-content1">Base content</div>
<div className="bg-content2">Secondary content</div>
<div className="bg-content3">Tertiary content</div>
<div className="bg-content4">Quaternary content</div>

```

**v3 Surface Colors:**

```tsx
// v3 - Surface colors for non-overlay components
<div className="bg-surface">Base surface</div>
<div className="bg-surface-secondary">Secondary surface</div>
<div className="bg-surface-tertiary">Tertiary surface</div>
<div className="bg-surface-quaternary">Quaternary surface</div>

// v3 - Overlay colors for floating components
<div className="bg-overlay">Overlay (tooltips, popovers, modals)</div>

```

**Migration Mapping:**

| v2 Class      | v3 Equivalent           | Usage                                            |
| ------------- | ----------------------- | ------------------------------------------------ |
| `bg-content1` | `bg-surface`            | Non-overlay components (cards, accordions)       |
| `bg-content1` | `bg-overlay`            | Floating components (tooltips, popovers, modals) |
| `bg-content2` | `bg-surface-secondary`  | Secondary surface level                          |
| `bg-content3` | `bg-surface-tertiary`   | Tertiary surface level                           |
| `bg-content4` | `bg-surface-quaternary` | Quaternary surface level                         |

**Key Changes:**

1. **Semantic Naming**: `content1-4` replaced with `surface` and `overlay` for clearer semantics
2. **Component-Specific**: Use `bg-surface` for page-level components, `bg-overlay` for floating components
3. **Auto-Calculated**: Surface levels (`secondary`, `tertiary`, `quaternary`) are automatically calculated from the base `surface` color using `color-mix()`

### Spacing & Layout Tokens

**v2 Layout Tokens:**

```css
--heroui-divider-weight: 1px;
--heroui-disabled-opacity: 0.5;
--heroui-hover-opacity: 0.8;

```

**v3 Layout Tokens:**

```css
--border-width: 0px;
--field-border-width: var(--border-width);
--disabled-opacity: 0.5;
--cursor-interactive: pointer;
--cursor-disabled: not-allowed;
--radius: 0.5rem;
--field-radius: calc(var(--radius) * 1.5);

```

### Shadow Tokens

**v2 Shadows:**

```css
--heroui-box-shadow-small: 0px 0px 5px 0px rgb(0 0 0 / 0.02), ...;
--heroui-box-shadow-medium: 0px 0px 15px 0px rgb(0 0 0 / 0.03), ...;
--heroui-box-shadow-large: 0px 0px 30px 0px rgb(0 0 0 / 0.04), ...;

```

**v3 Shadows:**

```css
--surface-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.04), ...;
--overlay-shadow: 0 4px 16px 0 rgba(24, 24, 27, 0.08), ...;
--field-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.04), ...;

```

**Key Changes:**

1. **Semantic Naming**: v3 uses semantic names (`surface-shadow`, `overlay-shadow`) instead of size-based names
2. **Component-Specific**: Shadows are tied to component types (surface, overlay, field)
3. **Dark Mode**: Dark mode shadows are transparent in v3

## Visual Differences

### Alignment Changes

**Button Alignment:**

* v2: Icons and text aligned with `items-center justify-center`
* v3: Same alignment, but with responsive height adjustments

**Input Alignment:**

* v2: Text aligned with `text-left`
* v3: Same alignment, but padding adjustments may affect visual balance

### Spacing Changes

**Component Padding:**

Most components have increased padding in v3:

* **Card**: 12px → 16px
* **Button**: Similar padding, but responsive heights
* **Input**: Added vertical padding (`py-2`)

**Gap Spacing:**

v3 uses more consistent gap spacing:

* **Card**: `gap-3` between header, content, footer
* **Button**: `gap-2` between icon and text
* **Chip**: `gap-1.5` between elements

### Size Changes

**Button Heights:**

* **Small**: 32px → 36px (mobile) / 32px (desktop)
* **Medium**: 40px → 40px (mobile) / 36px (desktop)
* **Large**: 48px → 44px (mobile) / 40px (desktop)

**Input Heights:**

* **Medium**: 40px → 36px (default, only size available)

### Border Radius Changes

**Default Radius:**

* v2: Components used `rounded-medium` (12px) by default
* v3: Components use larger radius values:
  * Button: `rounded-3xl` (24px)
  * Card: `rounded-3xl` (24px)
  * Chip: `rounded-2xl` (16px)
  * Input: `rounded-field` (typically 12-16px)

### Color Appearance Changes

**Color System:**

* v2: HSL color format
* v3: OKLCH color format (more perceptually uniform)

**Default Colors:**

* v2: `primary`, `secondary`, `success`, `warning`, `danger`
* v3: `accent` (replaces `primary`), `success`, `warning`, `danger`

**Muted Colors:**

* v2: `foreground-400`, `foreground-500` for muted text
* v3: `muted` color token for muted text

## Migration Examples

### Utility Class Migration

**Example: Text Utilities**

<Tabs items={["v2", "v3"]}>
  <Tab value="v2">
    ```tsx
    <div>
      <h1 className="text-large font-bold">Title</h1>
      <p className="text-small text-foreground-400">Description</p>
      <span className="text-tiny text-foreground-500">Helper</span>
    </div>
    ```
  </Tab>

  <Tab value="v3">
    ```tsx
    <div>
      <h1 className="text-lg font-bold">Title</h1>
      <p className="text-sm text-muted">Description</p>
      <span className="text-xs text-muted">Helper</span>
    </div>
    ```
  </Tab>
</Tabs>

### Border Radius Migration

**Example: Matching v2 Radius Values**

<Tabs items={["v2", "v3"]}>
  <Tab value="v2">
    ```tsx
    <Card radius="md">
      <CardBody>Content</CardBody>
    </Card>
    ```
  </Tab>

  <Tab value="v3">
    ```tsx
    {/* Option 1: Use standard Tailwind (smaller radius) */}
    <Card className="rounded-md">
      <Card.Content>Content</Card.Content>
    </Card>

    {/* Option 2: Match exact v2 value (12px) */}
    <Card className="rounded-[12px]">
      <Card.Content>Content</Card.Content>
    </Card>
    ```
  </Tab>
</Tabs>

### Theme Customization Migration

**Example: Custom Colors**

<Tabs items={["v2", "v3"]}>
  <Tab value="v2">
    ```js
    // tailwind.config.js
    const {heroui} = require("@heroui/react");

    module.exports = {
      plugins: [
        heroui({
          themes: {
            light: {
              colors: {
                primary: {
                  DEFAULT: "#006FEE",
                  50: "#E6F1FE",
                  // ... more shades
                },
              },
            },
          },
        }),
      ],
    };
    ```
  </Tab>

  <Tab value="v3">
    ```css
    /* globals.css */
    @import "tailwindcss";
    @import "@heroui/styles";

    :root {
      --accent: oklch(0.6204 0.195 253.83);
      --accent-foreground: oklch(0.9911 0 0);
    }
    ```
  </Tab>
</Tabs>

## Best Practices

1. **Use Standard Tailwind**: Prefer standard Tailwind utilities over custom ones
2. **Match v2 Values**: If exact v2 appearance is needed, use arbitrary values
3. **Test Responsively**: v3 has responsive sizing - test on multiple screen sizes
4. **Update CSS Variables**: If customizing, update CSS variables instead of Tailwind config
5. **Check Component Docs**: Refer to individual component migration guides for API changes

## Related Guides

* [Main Migration Guide](/docs/react/migration)
* [Theming Documentation](/docs/react/getting-started/handbook/theming)
* [Styling Guide](/docs/react/getting-started/handbook/styling)

</page>

<page url="/en/docs/react/releases">
