package helvetia.main;

import cz.jirutka.rsql.parser.RSQLParser;
import cz.jirutka.rsql.parser.ast.*;

import java.util.*;

/**
 * RSQL to SQL converter with column name mapping.
 * This variant supports mapping filter column names to qualified SQL column names,
 * which is useful for JOIN queries where columns need table prefixes.
 * 
 * For example: "region==Beijing" can be mapped to "r.region = ?" for a joined query.
 */
public class RsqlToSqlWithMapping {
    
    // Define custom operators for LIKE and IS NULL
    private static final ComparisonOperator LIKE = new ComparisonOperator("=like=", false);
    private static final ComparisonOperator NOT_LIKE = new ComparisonOperator("=notlike=", false);
    private static final ComparisonOperator IS_NULL = new ComparisonOperator("=isnull=", false);
    
    private static final Set<ComparisonOperator> OPERATORS = new HashSet<>(Arrays.asList(
        RSQLOperators.EQUAL,
        RSQLOperators.NOT_EQUAL,
        RSQLOperators.GREATER_THAN,
        RSQLOperators.GREATER_THAN_OR_EQUAL,
        RSQLOperators.LESS_THAN,
        RSQLOperators.LESS_THAN_OR_EQUAL,
        RSQLOperators.IN,
        RSQLOperators.NOT_IN,
        LIKE,
        NOT_LIKE,
        IS_NULL
    ));
    
    private final RSQLParser parser;
    
    // Mapping from filter column names to qualified SQL column names
    private final Map<String, String> columnMapping;
    
    // Numeric fields for type conversion
    private static final Set<String> NUMERIC_FIELDS = Set.of(
        "read_id", "read_timestamp", "user_id", "user_timestamp",
        "readTimeLength", "user_obtainedCredits"
    );
    
    public RsqlToSqlWithMapping(Map<String, String> columnMapping) {
        this.parser = new RSQLParser(OPERATORS);
        this.columnMapping = columnMapping;
    }
    
    /**
     * Result of converting RSQL to SQL
     */
    public static class SqlResult {
        public final String whereClause;
        public final List<Object> parameters;
        
        public SqlResult(String whereClause, List<Object> parameters) {
            this.whereClause = whereClause;
            this.parameters = parameters;
        }
    }
    
    /**
     * Parse RSQL and convert to SQL WHERE clause
     */
    public SqlResult convert(String rsql) {
        if (rsql == null || rsql.isBlank()) {
            return new SqlResult("1=1", Collections.emptyList());
        }
        
        Node rootNode = parser.parse(rsql);
        List<Object> params = new ArrayList<>();
        String sql = nodeToSql(rootNode, params);
        
        return new SqlResult(sql, params);
    }
    
    private String nodeToSql(Node node, List<Object> params) {
        if (node instanceof AndNode) {
            return logicalNodeToSql((AndNode) node, " AND ", params);
        } else if (node instanceof OrNode) {
            return logicalNodeToSql((OrNode) node, " OR ", params);
        } else if (node instanceof ComparisonNode) {
            return comparisonToSql((ComparisonNode) node, params);
        }
        throw new IllegalArgumentException("Unknown node type: " + node.getClass());
    }
    
    private String logicalNodeToSql(LogicalNode node, String operator, List<Object> params) {
        List<String> children = new ArrayList<>();
        for (Node child : node.getChildren()) {
            children.add(nodeToSql(child, params));
        }
        return "(" + String.join(operator, children) + ")";
    }
    
    private String comparisonToSql(ComparisonNode node, List<Object> params) {
        String field = node.getSelector();
        ComparisonOperator op = node.getOperator();
        List<String> args = node.getArguments();
        
        // Get the mapped column name (includes table alias)
        String mappedColumn = columnMapping.get(field);
        if (mappedColumn == null) {
            throw new IllegalArgumentException("Invalid column: " + field);
        }
        
        // Handle IS NULL specially
        if (op.equals(IS_NULL)) {
            boolean isNull = args.get(0).equalsIgnoreCase("true");
            return mappedColumn + (isNull ? " IS NULL" : " IS NOT NULL");
        }
        
        // Handle IN/NOT IN
        if (op.equals(RSQLOperators.IN) || op.equals(RSQLOperators.NOT_IN)) {
            String sqlOp = op.equals(RSQLOperators.IN) ? " IN " : " NOT IN ";
            String placeholders = String.join(", ", Collections.nCopies(args.size(), "?"));
            params.addAll(convertArgs(field, args));
            return mappedColumn + sqlOp + "(" + placeholders + ")";
        }
        
        // Handle LIKE/NOT LIKE
        if (op.equals(LIKE) || op.equals(NOT_LIKE)) {
            String sqlOp = op.equals(LIKE) ? " LIKE " : " NOT LIKE ";
            // Convert * wildcards to SQL % wildcards
            String pattern = args.get(0).replace("*", "%");
            params.add(pattern);
            return mappedColumn + sqlOp + "?";
        }
        
        // Standard comparison operators
        String sqlOp = switch (op.getSymbol()) {
            case "==" -> " = ";
            case "!=" -> " != ";
            case "=gt=" -> " > ";
            case "=ge=" -> " >= ";
            case "=lt=" -> " < ";
            case "=le=" -> " <= ";
            default -> throw new IllegalArgumentException("Unknown operator: " + op.getSymbol());
        };
        
        params.add(convertArg(field, args.get(0)));
        return mappedColumn + sqlOp + "?";
    }
    
    private List<Object> convertArgs(String field, List<String> args) {
        List<Object> result = new ArrayList<>();
        for (String arg : args) {
            result.add(convertArg(field, arg));
        }
        return result;
    }
    
    private Object convertArg(String field, String arg) {
        if (NUMERIC_FIELDS.contains(field)) {
            try {
                if (arg.contains(".")) {
                    return Double.parseDouble(arg);
                }
                return Long.parseLong(arg);
            } catch (NumberFormatException e) {
                // Fall through to string
            }
        }
        return arg;
    }
}
