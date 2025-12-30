package helvetia.main;

import helvetia.UserRead;
import java.util.List;

/**
 * DAO interface for the UserRead joined view.
 * This view joins the user and read tables on uid and region,
 * allowing Vitess to optimize queries by pushing them down to specific shards.
 */
public interface UserReadDao {
    /**
     * Placeholder count returned when exact count is too expensive (cross-shard join).
     * Client should detect end-of-list by checking if returned rows < requested limit.
     */
    long PLACEHOLDER_COUNT = -1;
    
    /**
     * List UserReads with optional RSQL filter, pagination, and sorting.
     * Filters can be applied on both user and read table fields.
     * When filtering on region or uid, Vitess will push the query to the appropriate shard.
     */
    List<UserRead> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception;
    
    /**
     * Count UserReads with optional RSQL filter.
     * 
     * When filtering by region, returns the exact count (single-shard query).
     * Otherwise, returns PLACEHOLDER_COUNT (-1) to avoid expensive cross-shard joins.
     * The client should detect end-of-list by checking if returned rows < requested limit.
     */
    long count(String rsqlFilter) throws Exception;
    
    /**
     * Check if the filter includes a region constraint that allows single-shard counting.
     */
    boolean hasRegionFilter(String rsqlFilter);
}
