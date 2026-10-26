# GDevelop Language (GDL) semantic instruction operands

The independent IfDo syntax has been removed. The semantic operand contract is
now implemented in `ProjectsStorage/SettingsDsl/InstructionCatalog.js` and the
unified parser. See [the complete format 11 specification](unified-settings-events-dsl-spec.md).

- Exact catalog type names and semantic named arguments are required.
- Condition/action kind comes from conditions/actions/while_conditions, with
  no if/do prefix. Child instructions inherit their parent kind.
- Text, names, objects, behaviors, variables and resources use JSON strings;
  numbers and booleans use direct literals.
- Computed number/text operands use expr(...), preserving balanced expression
  source, including native multiline expressions.
- Code-only operands are omitted; unknown or mismatched operands fail.
- Instructions project into native positional strings only at the model
  boundary; raw positional author syntax and raw JSON are forbidden.
- The generated instruction catalog format is gdevelop-settings-instruction-catalog,
  version 3. It is metadata for GDevelop Language (GDL), not another author language.
