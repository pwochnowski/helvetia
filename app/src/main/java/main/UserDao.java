package helvetia.main;

import helvetia.User;
import java.util.List;

public interface UserDao {
    void create(User u) throws Exception;
    User get(long id) throws Exception;
    void update(User u) throws Exception;
    boolean delete(long id) throws Exception;
    List<User> list() throws Exception;
    
    /**
     * List users with optional RSQL filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    List<User> list(String rsqlFilter) throws Exception;
    
    /**
     * List users with pagination and sorting support
     * @param rsqlFilter RSQL filter string, or null for no filtering
     * @param limit Maximum number of records to return
     * @param offset Number of records to skip
     * @param sortBy Column to sort by, or null for default (id)
     * @param sortDir Sort direction: "asc" or "desc"
     */
    List<User> list(String rsqlFilter, int limit, int offset, String sortBy, String sortDir) throws Exception;
    
    /**
     * Count total users matching filter
     * @param rsqlFilter RSQL filter string, or null for no filtering
     */
    long count(String rsqlFilter) throws Exception;
}

