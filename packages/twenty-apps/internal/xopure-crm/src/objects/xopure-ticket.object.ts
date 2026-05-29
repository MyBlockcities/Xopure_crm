import { defineObject, FieldType } from "twenty-sdk/define";

enum TicketStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  CANCELLED = 'CANCELLED',
}

export const XOPURE_TICKET_OBJECT_ID = '60dc27d4-6174-4f92-b602-76afb40d15a1';
export const XOPURE_TICKET_NUMBER_FIELD_ID = '4d918c40-33ce-42aa-b989-4cc1275a2f89';
export const XOPURE_TICKET_TITLE_FIELD_ID = 'a0567d76-f186-423d-bc4a-d057cb059bf3';
export const XOPURE_TICKET_DESCRIPTION_FIELD_ID = '65fd1b1a-0c73-4c86-adfc-7df89d67a236';
export const XOPURE_TICKET_STATUS_FIELD_ID = '4bafb386-52dc-41d1-a225-1218286fa957';
export const XOPURE_TICKET_LAST_SYNCED_AT_FIELD_ID = 'b17ef65a-d72d-44a2-ba7c-306230fcb9b9';

export default defineObject({
  universalIdentifier: XOPURE_TICKET_OBJECT_ID,
  nameSingular: 'xopureTicket',
  namePlural: 'xopureTickets',
  labelSingular: 'XO Pure Ticket',
  labelPlural: 'XO Pure Tickets',
  description: 'A synced ticket from XO Pure commerce and Supabase systems.',
  labelIdentifierFieldMetadataUniversalIdentifier: XOPURE_TICKET_TITLE_FIELD_ID,
  fields: [
    {
      universalIdentifier: XOPURE_TICKET_NUMBER_FIELD_ID,
      name: 'number',
      type: FieldType.TEXT,
      label: 'Number',
    },
    {
      universalIdentifier: XOPURE_TICKET_TITLE_FIELD_ID,
      name: 'title',
      type: FieldType.TEXT,
      label: 'Title',
    },
    {
      universalIdentifier: XOPURE_TICKET_DESCRIPTION_FIELD_ID,
      name: 'description',
      type: FieldType.RICH_TEXT,
      label: 'Description',
      icon: 'IconTextCaption',
    },
    {
      universalIdentifier: XOPURE_TICKET_STATUS_FIELD_ID,
      name: 'status',
      type: FieldType.SELECT,
      label: 'Status',
      options: [
        { id: '9857d748-5986-4e26-af8c-e496dcf79d3a', value: TicketStatus.OPEN, label: 'Open', position: 0, color: 'blue' },
        { id: '2dfccab0-8c64-45b4-a293-9da0667b2753', value: TicketStatus.CLOSED, label: 'Closed', position: 1, color: 'green' },
        { id: 'e23e0060-5490-44f9-a8bf-66567afbc652', value: TicketStatus.IN_PROGRESS, label: 'In progress', position: 2, color: 'yellow' },
        { id: 'ef9a0769-d19b-447a-8fbd-0fef9763839f', value: TicketStatus.ON_HOLD, label: 'On hold', position: 3, color: 'orange' },
        { id: '79d336b3-4f6b-4231-8b76-dcf15f5329c4', value: TicketStatus.CANCELLED, label: 'Cancelled', position: 4, color: 'red' },
      ],
    },
    {
        universalIdentifier: XOPURE_TICKET_LAST_SYNCED_AT_FIELD_ID,
        type: FieldType.DATE_TIME,
        name: 'lastSyncedAt',
        label: 'Last synced at',
        icon: 'IconRefresh',
        isNullable: true,
        defaultValue: null,
      },
  ],
});
