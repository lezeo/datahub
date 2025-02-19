import { Entity as EntityInterface, EntityType, SearchResult } from '../../types.generated';
import { FetchedEntity } from '../lineage/types';
import { Entity, EntityCapabilityType, IconStyleType, PreviewType } from './Entity';
import { GenericEntityProperties } from './shared/types';
import { dictToQueryStringParams, urlEncodeUrn } from './shared/utils';

function validatedGet<K, V>(key: K, map: Map<K, V>): V {
    if (map.has(key)) {
        return map.get(key) as V;
    }
    throw new Error(`Unrecognized key ${key} provided in map ${JSON.stringify(map)}`);
}

/**
 * Serves as a singleton registry for all DataHub entities to appear on the frontend.
 */
export default class EntityRegistry {
    entities: Array<Entity<any>> = new Array<Entity<any>>();

    entityTypeToEntity: Map<EntityType, Entity<any>> = new Map<EntityType, Entity<any>>();

    collectionNameToEntityType: Map<string, EntityType> = new Map<string, EntityType>();

    pathNameToEntityType: Map<string, EntityType> = new Map<string, EntityType>();

    register(entity: Entity<any>) {
        this.entities.push(entity);
        this.entityTypeToEntity.set(entity.type, entity);
        this.collectionNameToEntityType.set(entity.getCollectionName(), entity.type);
        this.pathNameToEntityType.set(entity.getPathName(), entity.type);
    }

    getEntity(type: EntityType): Entity<any> {
        return validatedGet(type, this.entityTypeToEntity);
    }

    getEntities(): Array<Entity<any>> {
        return this.entities;
    }

    getSearchEntityTypes(): Array<EntityType> {
        return this.entities.filter((entity) => entity.isSearchEnabled()).map((entity) => entity.type);
    }

    getDefaultSearchEntityType(): EntityType {
        return this.entities[0].type;
    }

    getBrowseEntityTypes(): Array<EntityType> {
        return this.entities.filter((entity) => entity.isBrowseEnabled()).map((entity) => entity.type);
    }

    getLineageEntityTypes(): Array<EntityType> {
        return this.entities.filter((entity) => entity.isLineageEnabled()).map((entity) => entity.type);
    }

    getIcon(type: EntityType, fontSize: number, styleType: IconStyleType, color?: string): JSX.Element {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.icon(fontSize, styleType, color);
    }

    getCollectionName(type: EntityType): string {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.getCollectionName();
    }

    getEntityName(type: EntityType): string | undefined {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.getEntityName?.();
    }

    getTypeFromCollectionName(name: string): EntityType {
        return validatedGet(name, this.collectionNameToEntityType);
    }

    getPathName(type: EntityType): string {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.getPathName();
    }

    getEntityUrl(type: EntityType, urn: string, params?: Record<string, string | boolean>): string {
        return `/${this.getPathName(type)}/${urlEncodeUrn(urn)}${params ? `?${dictToQueryStringParams(params)}` : ''}`;
    }

    getTypeFromPathName(pathName: string): EntityType {
        return validatedGet(pathName, this.pathNameToEntityType);
    }

    getTypeOrDefaultFromPathName(pathName: string, def?: EntityType): EntityType | undefined {
        try {
            return validatedGet(pathName, this.pathNameToEntityType);
        } catch (e) {
            return def;
        }
    }

    renderProfile(type: EntityType, urn: string): JSX.Element {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.renderProfile(urn);
    }

    renderPreview<T>(entityType: EntityType, type: PreviewType, data: T): JSX.Element {
        const entity = validatedGet(entityType, this.entityTypeToEntity);
        return entity.renderPreview(type, data);
    }

    renderSearchResult(type: EntityType, searchResult: SearchResult): JSX.Element {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.renderSearch(searchResult);
    }

    renderBrowse<T>(type: EntityType, data: T): JSX.Element {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.renderPreview(PreviewType.BROWSE, data);
    }

    // render the regular profile if embedded profile doesn't exist. Compact context should be set to true.
    renderEmbeddedProfile(type: EntityType, urn: string): JSX.Element {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.renderEmbeddedProfile ? entity.renderEmbeddedProfile(urn) : entity.renderProfile(urn);
    }

    getLineageVizConfig<T>(type: EntityType, data: T): FetchedEntity | undefined {
        const entity = validatedGet(type, this.entityTypeToEntity);
        const genericEntityProperties = this.getGenericEntityProperties(type, data);
        return (
            ({
                ...entity.getLineageVizConfig?.(data),
                downstreamChildren: genericEntityProperties?.downstream?.relationships
                    ?.filter((relationship) => relationship.entity)
                    // eslint-disable-next-line @typescript-eslint/dot-notation
                    ?.filter((relationship) => !relationship.entity?.['status']?.removed)
                    ?.map((relationship) => ({
                        entity: relationship.entity as EntityInterface,
                        type: (relationship.entity as EntityInterface).type,
                    })),
                downstreamRelationships: genericEntityProperties?.downstream?.relationships
                    ?.filter((relationship) => relationship.entity)
                    // eslint-disable-next-line @typescript-eslint/dot-notation
                    ?.filter((relationship) => !relationship.entity?.['status']?.removed),
                numDownstreamChildren: genericEntityProperties?.downstream?.total,
                upstreamChildren: genericEntityProperties?.upstream?.relationships
                    ?.filter((relationship) => relationship.entity)
                    // eslint-disable-next-line @typescript-eslint/dot-notation
                    ?.filter((relationship) => !relationship.entity?.['status']?.removed)
                    ?.map((relationship) => ({
                        entity: relationship.entity as EntityInterface,
                        type: (relationship.entity as EntityInterface).type,
                    })),
                upstreamRelationships: genericEntityProperties?.upstream?.relationships
                    ?.filter((relationship) => relationship.entity)
                    // eslint-disable-next-line @typescript-eslint/dot-notation
                    ?.filter((relationship) => !relationship.entity?.['status']?.removed),
                numUpstreamChildren: genericEntityProperties?.upstream?.total,
                status: genericEntityProperties?.status,
                siblingPlatforms: genericEntityProperties?.siblingPlatforms,
                fineGrainedLineages: genericEntityProperties?.fineGrainedLineages,
                schemaMetadata: genericEntityProperties?.schemaMetadata,
                inputFields: genericEntityProperties?.inputFields,
                canEditLineage: genericEntityProperties?.privileges?.canEditLineage,
            } as FetchedEntity) || undefined
        );
    }

    getDisplayName<T>(type: EntityType, data: T): string {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.displayName(data);
    }

    getGenericEntityProperties<T>(type: EntityType, data: T): GenericEntityProperties | null {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.getGenericEntityProperties(data);
    }

    getSupportedEntityCapabilities(type: EntityType): Set<EntityCapabilityType> {
        const entity = validatedGet(type, this.entityTypeToEntity);
        return entity.supportedCapabilities();
    }

    getTypesWithSupportedCapabilities(capability: EntityCapabilityType): Set<EntityType> {
        return new Set(
            this.getEntities()
                .filter((entity) => entity.supportedCapabilities().has(capability))
                .map((entity) => entity.type),
        );
    }
}
