package helvetia.main;

import cz.jirutka.rsql.parser.RSQLParser;
import cz.jirutka.rsql.parser.ast.*;

import java.util.*;

/**
 * Converts RSQL filter expressions to MySQL WHERE clauses with parameterized queries.
 * 
 * Supports operators:
 * - == (equals)
 * - != (not equals)
 * - =gt= (greater than)
 * - =ge= (greater than or equal)
 * - =lt= (less than)
 * - =le= (less than or equal)
 * - =in= (in list)
 * - =out= (not in list)
 * - =like= (SQL LIKE with wildcards)
 * - =notlike= (SQL NOT LIKE)
 * - =isnull= (IS NULL / IS NOT NULL)
 * 
 * Example RSQL: name==John;age=gt=25;region=in=(Beijing,HongKong)
 * Produces SQL: name = ? AND age > ? AND region IN (?, ?)
 * With params: ["John", 25, "Beijing", "HongKong"]
 */
public class RsqlToSql {
    
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
    
    // Allowed columns to prevent SQL injection
    private final Set<String> allowedColumns;
    
    public RsqlToSql(Set<String> allowedColumns) {
        this.parser = new RSQLParser(OPERATORS);
        this.allowedColumns = allowedColumns;
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
     * 
     * @param rsql The RSQL query string
     * @return SqlResult with WHERE clause (without "WHERE" keyword) and parameters
     * @throws IllegalArgumentException if the RSQL is invalid or uses disallowed columns
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
        
        // Validate field name to prevent SQL injection
        if (!allowedColumns.contains(field)) {
            throw new IllegalArgumentException("Invalid column: " + field);
        }
        
        // Escape field name with backticks for MySQL
        String escapedField = "`" + field + "`";
        
        // Handle IS NULL specially
        if (op.equals(IS_NULL)) {
            boolean isNull = args.get(0).equalsIgnoreCase("true");
            return escapedField + (isNull ? " IS NULL" : " IS NOT NULL");
        }
        
        // Handle IN/NOT IN
        if (op.equals(RSQLOperators.IN) || op.equals(RSQLOperators.NOT_IN)) {
            String sqlOp = op.equals(RSQLOperators.IN) ? " IN " : " NOT IN ";
            String placeholders = String.join(", ", Collections.nCopies(args.size(), "?"));
            params.addAll(convertArgs(field, args));
            return escapedField + sqlOp + "(" + placeholders + ")";
        }
        
        // Handle LIKE/NOT LIKE
        if (op.equals(LIKE) || op.equals(NOT_LIKE)) {
            String sqlOp = op.equals(LIKE) ? " LIKE " : " NOT LIKE ";
            // Convert * wildcards to SQL % wildcards
            String pattern = args.get(0).replace("*", "%");
            params.add(pattern);
            return escapedField + sqlOp + "?";
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
        return escapedField + sqlOp + "?";
    }
    
    /**
     * Convert string arguments to appropriate types based on field
     */
    private List<Object> convertArgs(String field, List<String> args) {
        List<Object> result = new ArrayList<>();
        for (String arg : args) {
            result.add(convertArg(field, arg));
        }
        return result;
    }
    
    private Object convertArg(String field, String arg) {
        // Try to detect numeric fields and convert
        // You can customize this based on your schema
        if (isNumericField(field)) {
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
    
    /**
     * Check if a field should be treated as numeric
     */
    private boolean isNumericField(String field) {
        // Add your numeric fields here
        return Set.of("id", "timestamp", "obtainedCredits").contains(field);
    }
}
