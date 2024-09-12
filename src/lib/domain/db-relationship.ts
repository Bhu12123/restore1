import { ForeignKeyInfo } from '../data/import-metadata/metadata-types/foreign-key-info';
import { DBField } from './db-field';
import {
    schemaNameToDomainSchemaName,
    schemaNameToSchemaId,
} from './db-schema';
import { DBTable } from './db-table';
import { generateId } from '@/lib/utils';

export interface DBRelationship {
    id: string;
    name: string;
    sourceSchema?: string;
    sourceTableId: string;
    targetSchema?: string;
    targetTableId: string;
    sourceFieldId: string;
    targetFieldId: string;
    sourceCardinality: Cardinality;
    targetCardinality: Cardinality;
    createdAt: number;
}

export type RelationshipType =
    | 'one_to_one'
    | 'one_to_many'
    | 'many_to_one'
    | 'many_to_many';
export type Cardinality = 'one' | 'many';

export const shouldShowRelationshipBySchemaFilter = (
    relationship: DBRelationship,
    filteredSchemas?: string[]
): boolean =>
    !filteredSchemas ||
    !relationship.sourceSchema ||
    !relationship.targetSchema ||
    (filteredSchemas.includes(
        schemaNameToSchemaId(relationship.sourceSchema)
    ) &&
        filteredSchemas.includes(
            schemaNameToSchemaId(relationship.targetSchema)
        ));

export const createRelationshipsFromMetadata = ({
    foreignKeys,
    tables,
}: {
    foreignKeys: ForeignKeyInfo[];
    tables: DBTable[];
}): DBRelationship[] => {
    return foreignKeys
        .map((fk: ForeignKeyInfo) => {
            const schema = schemaNameToDomainSchemaName(fk.schema);
            const sourceTable = tables.find(
                (table) => table.name === fk.table && table.schema === schema
            );

            const targetSchema = schemaNameToDomainSchemaName(
                fk.reference_schema
            );

            const targetTable = tables.find(
                (table) =>
                    table.name === fk.reference_table &&
                    table.schema === targetSchema
            );
            const sourceField = sourceTable?.fields.find(
                (field) => field.name === fk.column
            );
            const targetField = targetTable?.fields.find(
                (field) => field.name === fk.reference_column
            );

            const isSourceTablePKComplex =
                (sourceTable?.fields.filter((field) => field.primaryKey) ?? [])
                    .length > 1;
            const isTargetTablePKComplex =
                (targetTable?.fields.filter((field) => field.primaryKey) ?? [])
                    .length > 1;

            if (sourceTable && targetTable && sourceField && targetField) {
                const sourceCardinality = determineCardinality(
                    sourceField,
                    isSourceTablePKComplex
                );
                const targetCardinality = determineCardinality(
                    targetField,
                    isTargetTablePKComplex
                );
                const type = determineRelationshipType({
                    sourceCardinality,
                    targetCardinality,
                });

                return {
                    id: generateId(),
                    name: fk.foreign_key_name,
                    sourceSchema: schema,
                    targetSchema: targetSchema,
                    sourceTableId: sourceTable.id,
                    targetTableId: targetTable.id,
                    sourceFieldId: sourceField.id,
                    targetFieldId: targetField.id,
                    type,
                    sourceCardinality,
                    targetCardinality,
                    createdAt: Date.now(),
                } as DBRelationship;
            }

            return null;
        })
        .filter((rel) => rel !== null) as DBRelationship[];
};

const determineCardinality = (
    field: DBField,
    isTablePKComplex: boolean
): Cardinality => {
    return field.unique || (field.primaryKey && !isTablePKComplex)
        ? 'one'
        : 'many';
};

export const determineRelationshipType = ({
    sourceCardinality,
    targetCardinality,
}: {
    sourceCardinality: Cardinality;
    targetCardinality: Cardinality;
}): RelationshipType => {
    if (sourceCardinality === 'one' && targetCardinality === 'one')
        return 'one_to_one';
    if (sourceCardinality === 'one' && targetCardinality === 'many')
        return 'one_to_many';
    if (sourceCardinality === 'many' && targetCardinality === 'one')
        return 'many_to_one';
    return 'many_to_many';
};

export const determineCardinalities = (
    relationshipType: RelationshipType
): {
    sourceCardinality: Cardinality;
    targetCardinality: Cardinality;
} => {
    switch (relationshipType) {
        case 'one_to_one':
            return { sourceCardinality: 'one', targetCardinality: 'one' };
        case 'one_to_many':
            return { sourceCardinality: 'one', targetCardinality: 'many' };
        case 'many_to_one':
            return { sourceCardinality: 'many', targetCardinality: 'one' };
        case 'many_to_many':
            return { sourceCardinality: 'many', targetCardinality: 'many' };
    }
};
