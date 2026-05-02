## molecule_viewer

**Use when**: displaying molecular structures — organic molecules, proteins, drug-receptor complexes.

**Props**:
- `format` (**required**): `"smiles"` | `"pdb"` | `"sdf"` | `"mol2"` | `"xyz"` | `"cif"`
- `data` (string, **required**): molecule data in the specified format (e.g. `"CCO"` for ethanol)
- `style` (optional, default `"ballAndStick"`): `"ballAndStick"` | `"stick"` | `"sphere"` | `"cartoon"` | `"surface"`
- `colorScheme` (optional, default `"element"`): `"element"` | `"residue"` | `"chain"` | `"spectrum"`
- `spin` (boolean, optional, default `false`)
- `height` (number, optional, default `360`)
- `caption` (string, optional)

**Example**:
```json
{
  "id": "b7", "type": "entity", "entity_type": "molecule_viewer",
  "props": {
    "format": "smiles",
    "data": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    "style": "ballAndStick", "spin": true,
    "caption": "Caffeine molecule"
  }
}
```
