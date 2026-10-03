import { Question } from '@/types';
type Entry = [string, string[], number];
const banks: Record<string, Entry[]> = {
  Python: [
    ['Which keyword defines a function?', ['function', 'def', 'func', 'define'], 1],
    ['Which collection is immutable?', ['List', 'Set', 'Dictionary', 'Tuple'], 3],
    [
      'Which statement handles an exception?',
      ['try / except', 'if / else', 'for / in', 'with / as'],
      0,
    ],
    ['What does len([1, 2, 3]) return?', ['2', '3', '4', 'An error'], 1],
    ['How do you create an empty dictionary?', ['[]', '()', '{}', '<>'], 2],
    ['What does a list comprehension create?', ['A module', 'A class', 'A file', 'A new list'], 3],
    ['Which operator checks value equality?', ['==', '=', 'is', '!='], 0],
    ['Which keyword yields values from a generator?', ['return', 'yield', 'send', 'emit'], 1],
    ['What does range(3) produce?', ['1, 2, 3', '0, 1, 2', '0, 1, 2, 3', '3 only'], 1],
    [
      'What is a virtual environment used for?',
      ['Increasing RAM', 'Compiling Java', 'Isolating dependencies', 'Editing CSS'],
      2,
    ],
  ],
  SQL: [
    ['Which statement retrieves data?', ['INSERT', 'SELECT', 'UPDATE', 'DELETE'], 1],
    ['Which clause filters rows before grouping?', ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], 0],
    [
      'Which JOIN includes all rows from the left table?',
      ['INNER JOIN', 'CROSS JOIN', 'LEFT JOIN', 'RIGHT JOIN'],
      2,
    ],
    ['What does COUNT(*) count?', ['Columns', 'Unique values only', 'Null columns', 'Rows'], 3],
    ['Which constraint uniquely identifies a row?', ['DEFAULT', 'PRIMARY KEY', 'CHECK', 'NULL'], 1],
    ['Which clause sorts query results?', ['GROUP BY', 'WHERE', 'HAVING', 'ORDER BY'], 3],
    ['Which clause filters grouped results?', ['SELECT', 'HAVING', 'FROM', 'JOIN'], 1],
    [
      'What does an index primarily improve?',
      ['Text formatting', 'Query lookup speed', 'Table naming', 'Database colors'],
      1,
    ],
    ['Which statement removes selected rows?', ['DROP TABLE', 'DELETE', 'CREATE', 'ALTER'], 1],
    [
      'What does a foreign key establish?',
      ['A table relationship', 'A sort order', 'A password', 'A backup schedule'],
      0,
    ],
  ],
  AWS: [
    ['Which service provides virtual servers?', ['S3', 'EC2', 'IAM', 'Route 53'], 1],
    ['Which service is designed for object storage?', ['Lambda', 'RDS', 'S3', 'CloudWatch'], 2],
    [
      'What is IAM used for?',
      ['Identity and access management', 'Image editing', 'Database joins', 'Frontend routing'],
      0,
    ],
    ['Which service runs event-driven functions?', ['EC2', 'EBS', 'VPC', 'Lambda'], 3],
    [
      'What is an Availability Zone?',
      ['A billing period', 'An isolated location within a region', 'A username', 'An API endpoint'],
      1,
    ],
    ['Which service provides managed relational databases?', ['RDS', 'SNS', 'SQS', 'S3'], 0],
    [
      'What does least privilege mean?',
      ['No logging', 'Allow all requests', 'Only necessary permissions', 'Share root credentials'],
      2,
    ],
    [
      'Which service collects metrics and logs?',
      ['Route 53', 'CloudWatch', 'IAM', 'CloudFront'],
      1,
    ],
    [
      'What is a VPC?',
      [
        'A virtual private cloud network',
        'A pricing calculator',
        'A database key',
        'A code editor',
      ],
      0,
    ],
    ['Which service is a content delivery network?', ['SQS', 'SES', 'DynamoDB', 'CloudFront'], 3],
  ],
  Java: [
    ['Which keyword defines a class?', ['object', 'class', 'struct', 'define'], 1],
    ['Which type stores true or false?', ['int', 'String', 'boolean', 'double'], 2],
    [
      'What is JVM short for?',
      [
        'Java Virtual Machine',
        'Java Variable Method',
        'Joint Version Manager',
        'Java Visual Module',
      ],
      0,
    ],
    ['Which keyword creates an object?', ['make', 'create', 'init', 'new'], 3],
    [
      'Which collection maintains insertion order and allows duplicates?',
      ['HashSet', 'ArrayList', 'TreeSet', 'Map'],
      1,
    ],
    [
      'Which keyword prevents a class from being extended?',
      ['static', 'final', 'public', 'abstract'],
      1,
    ],
    ['Which block handles exceptions?', ['catch', 'while', 'switch', 'class'], 0],
    [
      'What does inheritance allow?',
      [
        'Changing Java syntax',
        'Reusing behavior from a parent class',
        'Removing all methods',
        'Skipping compilation',
      ],
      1,
    ],
    [
      'Which access modifier is most restrictive?',
      ['public', 'protected', 'private', 'default'],
      2,
    ],
    [
      'What does method overloading mean?',
      [
        'Removing methods',
        'Same method name with different parameters',
        'Changing a file extension',
        'Calling two threads',
      ],
      1,
    ],
  ],
  JavaScript: [
    ['Which declaration is block scoped?', ['var', 'let', 'global', 'declare'], 1],
    ['Which operator compares value and type?', ['=', '==', '===', '!='], 2],
    [
      'What does Array.map return?',
      ['A new array', 'The original array only', 'A boolean', 'A string always'],
      0,
    ],
    [
      'What does a Promise represent?',
      ['A CSS style', 'A loop', 'A database table', 'An eventual asynchronous result'],
      3,
    ],
    [
      'Which keyword waits for a Promise in an async function?',
      ['yield', 'await', 'pause', 'wait'],
      1,
    ],
    [
      'What is a closure?',
      [
        'A function with access to its lexical environment',
        'A deleted variable',
        'A CSS selector',
        'A request header',
      ],
      0,
    ],
    [
      'Which method parses JSON text?',
      ['JSON.stringify', 'JSON.read', 'JSON.parse', 'JSON.load'],
      2,
    ],
    ['What is the value of typeof null?', ['null', 'undefined', 'object', 'boolean'], 2],
    ['Which event commonly handles a button activation?', ['load', 'scroll', 'resize', 'click'], 3],
    [
      'What does an async function always return?',
      ['A number', 'A Promise', 'An array', 'A DOM node'],
      1,
    ],
  ],
  'Node.js': [
    [
      'What is Node.js?',
      ['A CSS framework', 'A JavaScript runtime', 'A database only', 'An operating system'],
      1,
    ],
    ['Which module provides filesystem operations?', ['http', 'path', 'fs', 'url'], 2],
    [
      'What is the event loop responsible for?',
      [
        'Coordinating asynchronous callbacks',
        'Drawing graphics',
        'Writing CSS',
        'Changing passwords',
      ],
      0,
    ],
    [
      'Which package file declares dependencies?',
      ['index.html', 'README.md', 'main.css', 'package.json'],
      3,
    ],
    ['Which HTTP status indicates a missing resource?', ['200', '404', '201', '204'], 1],
    [
      'What does middleware commonly do?',
      [
        'Process a request before the final handler',
        'Change JavaScript syntax',
        'Replace an operating system',
        'Compress RAM',
      ],
      0,
    ],
    ['Which built-in module can create an HTTP server?', ['fs', 'path', 'http', 'os'], 2],
    [
      'Why avoid blocking filesystem calls in request handlers?',
      [
        'They change file names',
        'They make code colorful',
        'They block other event-loop work',
        'They create HTML',
      ],
      2,
    ],
    [
      'What is process.env typically used for?',
      ['CSS variables', 'SVG shapes', 'Query joins', 'Environment configuration'],
      3,
    ],
    [
      'Which method should handle unexpected promise rejections?',
      [
        'Ignoring them',
        'A catch handler or try/catch with await',
        'Reloading CSS',
        'Changing HTML IDs',
      ],
      1,
    ],
  ],
  TypeScript: [
    [
      'What does TypeScript add to JavaScript?',
      ['A database', 'Static types', 'A browser', 'An operating system'],
      1,
    ],
    [
      'Which keyword describes an object contract?',
      ['interface', 'package', 'schemaOnly', 'objectify'],
      0,
    ],
    [
      'What is a union type?',
      [
        'A SQL join',
        'Two variables',
        'A value allowed to have multiple specified types',
        'A CSS rule',
      ],
      2,
    ],
    [
      'Which type accepts a value but requires narrowing before use?',
      ['any', 'never', 'void', 'unknown'],
      3,
    ],
    ['What does an optional property use?', ['!', '?', '#', '@'], 1],
    [
      'What is a generic type used for?',
      [
        'Reusing type-safe logic across types',
        'Ignoring compiler errors',
        'Generating CSS',
        'Creating databases',
      ],
      0,
    ],
    ['Which type denotes no returned value?', ['string', 'boolean', 'void', 'number'], 2],
    [
      'What does readonly indicate?',
      [
        'A property cannot be reassigned through that type',
        'An encrypted file',
        'A private method',
        'A hidden HTML element',
      ],
      0,
    ],
    [
      'What is type narrowing?',
      [
        'Reducing a file size',
        'Removing functions',
        'Changing UI width',
        'Refining a broader type using checks',
      ],
      3,
    ],
    [
      'Which expression is a type guard for a string?',
      ['value is CSS', 'typeof value === "string"', 'value = string', 'String.isType(value)'],
      1,
    ],
  ],
};
export function getSkillQuestions(skill?: string): Question[] | undefined {
  return skill && banks[skill]
    ? banks[skill].map((q, i) => ({
        prompt: q[0],
        options: q[1],
        answer: q[2],
        topic: i < 4 ? 'Fundamentals' : i < 7 ? 'Application' : 'Best practices',
      }))
    : undefined;
}
