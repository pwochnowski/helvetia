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
}

