import { defineObject, FieldType } from 'twenty-sdk/define';

export const XOPURE_UI_COMPOSITION_OBJECT_ID = '9ed37e49-6ff3-4e7f-8ca0-505cced97791';
export const XOPURE_UI_COMPOSITION_NAME_FIELD_ID = '72541290-8496-4c3d-a6dd-5405b0c51ae6';
export const XOPURE_UI_COMPOSITION_SCHEMA_VERSION_FIELD_ID = '4d49a777-ef7c-405b-8526-0f708d5eecc4';
export const XOPURE_UI_COMPOSITION_CATALOG_VERSION_FIELD_ID = '370b8dbd-8b0a-4be1-8641-c854d2ff495b';
export const XOPURE_UI_COMPOSITION_STATUS_FIELD_ID = '81229115-9e83-46f5-82e5-4e0dc6d6a257';
export const XOPURE_UI_COMPOSITION_DOCUMENT_FIELD_ID = '4b76a3ef-816b-4cbf-bb93-e727584c7c1d';
export const XOPURE_UI_COMPOSITION_VALIDATION_ERRORS_FIELD_ID = '8fc47d14-b731-487f-91c5-c39e9380a26b';
export const XOPURE_UI_COMPOSITION_SOURCE_TOOL_FIELD_ID = '0e364ff7-beb5-4ee3-a5c8-3f2fab8f5d4b';

export default defineObject({
  universalIdentifier: XOPURE_UI_COMPOSITION_OBJECT_ID,
  nameSingular: 'xopureUiComposition',
  namePlural: 'xopureUiCompositions',
  labelSingular: 'XO Pure UI Composition',
  labelPlural: 'XO Pure UI Compositions',
  description: 'Validated XO Pure composable GenUI document.',
  icon: 'IconLayoutDashboard',
  labelIdentifierFieldMetadataUniversalIdentifier: XOPURE_UI_COMPOSITION_NAME_FIELD_ID,
  fields: [
    { universalIdentifier: XOPURE_UI_COMPOSITION_NAME_FIELD_ID, type: FieldType.TEXT, name: 'name', label: 'Name', icon: 'IconForms' },
    { universalIdentifier: XOPURE_UI_COMPOSITION_SCHEMA_VERSION_FIELD_ID, type: FieldType.NUMBER, name: 'schemaVersion', label: 'Schema version', icon: 'IconCode' },
    { universalIdentifier: XOPURE_UI_COMPOSITION_CATALOG_VERSION_FIELD_ID, type: FieldType.TEXT, name: 'catalogVersion', label: 'Catalog version', icon: 'IconTag' },
    {
      universalIdentifier: XOPURE_UI_COMPOSITION_STATUS_FIELD_ID,
      type: FieldType.SELECT,
      name: 'status',
      label: 'Status',
      icon: 'IconProgressCheck',
      defaultValue: "'DRAFT'",
      options: [
        { id: '402483c9-ef14-4e1c-912f-63b2b4d64b76', value: 'DRAFT', label: 'Draft', position: 0, color: 'gray' },
        { id: '0c902a13-c8c5-4e01-a4c9-b1bc0e6695f5', value: 'READY', label: 'Ready', position: 1, color: 'green' },
        { id: '4bef9fa2-81ca-4b70-b59a-9b87721ee754', value: 'ARCHIVED', label: 'Archived', position: 2, color: 'orange' },
        { id: '4b9c177e-0b91-4b44-a48c-6a38295c9cc5', value: 'INVALID', label: 'Invalid', position: 3, color: 'red' },
      ],
    },
    { universalIdentifier: XOPURE_UI_COMPOSITION_DOCUMENT_FIELD_ID, type: FieldType.RAW_JSON, name: 'document', label: 'Document', icon: 'IconBraces' },
    { universalIdentifier: XOPURE_UI_COMPOSITION_VALIDATION_ERRORS_FIELD_ID, type: FieldType.TEXT, name: 'validationErrors', label: 'Validation errors', icon: 'IconAlertTriangle', isNullable: true, defaultValue: null },
    { universalIdentifier: XOPURE_UI_COMPOSITION_SOURCE_TOOL_FIELD_ID, type: FieldType.TEXT, name: 'sourceTool', label: 'Source tool', icon: 'IconTool', isNullable: true, defaultValue: null },
  ],
});
