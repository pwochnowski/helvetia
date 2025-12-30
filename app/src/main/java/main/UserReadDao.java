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
     * List UserReads with optional RSQL filter, pagination, and sorting.
     * Filters can be applied on both user and read table fields.
     * When filtering on region or uid, Vitess will push the query to the appropriate shard.
     */
    List<UserRead> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception;
    
    /**
     * Count UserReads with optional RSQL filter.
     */
    long count(String rsqlFilter) throws Exception;
}
