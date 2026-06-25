# TipTap Integration - ChefChek

## Integración del Editor TipTap

ChefChek implementa TipTap como editor de texto enriquecido para las instrucciones de elaboración de recetas, permitiendo contenido estructurado, versionado y multiformato.

## Arquitectura TipTap

### Stack Tecnológico

```typescript
// Frontend (Next.js)
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import ListItem from '@tiptap/extension-list-item';
```

### Extensiones Configuradas

**Core Extensions:**
- `StarterKit` - Edición básica (bold, italic, headings, lists, etc.)
- `Underline` - Texto subrayado
- `TextAlign` - Alineación de texto (left, center, right)
- `ListItem` - Items de lista personalizables

## Implementación Frontend

### 1. Hook useEditor

```typescript
import { useEditor } from '@tiptap/react';

const editor = useEditor({
  extensions: [
    StarterKit,
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    ListItem,
  ],
  content: '', // Contenido inicial vacío
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose lg:prose-xl mx-auto focus:outline-none',
    },
  },
});
```

### 2. Componente UI del Editor

```typescript
<div className="border border-gray-300 rounded-md">
  {/* Toolbar */}
  <div className="bg-gray-50 px-4 py-2 border-b flex space-x-2">
    <button
      onClick={() => editor?.chain().focus().toggleBold().run()}
      className={`px-3 py-1 rounded ${editor?.isActive('bold') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
    >
      Bold
    </button>
    <button
      onClick={() => editor?.chain().focus().toggleItalic().run()}
      className={`px-3 py-1 rounded ${editor?.isActive('italic') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
    >
      Italic
    </button>
    <button
      onClick={() => editor?.chain().focus().toggleUnderline().run()}
      className={`px-3 py-1 rounded ${editor?.isActive('underline') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
    >
      Underline
    </button>
    <button
      onClick={() => editor?.chain().focus().toggleBulletList().run()}
      className={`px-3 py-1 rounded ${editor?.isActive('bulletList') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
    >
      Bullet List
    </button>
    <button
      onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      className={`px-3 py-1 rounded ${editor?.isActive('orderedList') ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
    >
      Numbered List
    </button>
  </div>

  {/* Área de edición */}
  <EditorContent editor={editor} className="prose max-w-none p-4" />
</div>
```

## Estructura JSON de TipTap

### Ejemplo de Contenido

```typescript
const elaborationContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Instrucciones de Preparación" }]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Comenzar picando los tomates en cubos pequeños de aproximadamente 2cm." }
      ]
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Cocer a fuego medio durante 20 minutos" }]
            }
          ]
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Remover del fuego y dejar enfriar" }]
            }
          ]
        }
      ]
    },
    {
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: "Importante:" },
        { type: "text", text: " No olvidar remover las semillas de los tomates." }
      ]
    }
  ]
};
```

### Tipos de Nodos y Marcas

**Nodos (Nodes):**
- `doc` - Documento raíz
- `paragraph` - Párrafo
- `heading` - Títulos (h1-h6)
- `text` - Texto simple
- `bulletList` - Lista no ordenada
- `orderedList` - Lista ordenada
- `listItem` - Item de lista

**Marcas (Marks):**
- `bold` - Negrita
- `italic` - Cursiva
- `underline` - Subrayado
- `textAlign` - Alineación de texto

## Backend Integration

### 1. Validación JSON

```typescript
async createRecipe(createRecipeDto: CreateRecipeDto): Promise<RecipeResponse> {
  const { elaboration } = createRecipeDto;

  // Validar que elaboration sea JSON válido (TipTap)
  let parsedElaboration;
  try {
    parsedElaboration = JSON.parse(elaboration);
  } catch (error) {
    throw new BadRequestException('Elaboration must be valid TipTap JSON');
  }

  // Validar estructura mínima
  if (!parsedElaboration.type || parsedElaboration.type !== 'doc') {
    throw new BadRequestException('Elaboration must have root "doc" node');
  }

  // Guardar como string JSON
  const recipe = await this.prisma.recipe.create({
    data: {
      ...createRecipeDto,
      elaboration: JSON.stringify(parsedElaboration),
    },
  });

  return this.formatRecipeResponse(recipe);
}
```

### 2. Recuperación y Parseo

```typescript
async findOne(tenantId: string, id: string): Promise<RecipeResponse> {
  const recipe = await this.prisma.recipe.findFirst({
    where: { id, tenantId, isActive: true },
  });

  if (!recipe) {
    throw new NotFoundException(`Recipe with ID ${id} not found`);
  }

  // Parsear JSON para el frontend
  const parsedElaboration = JSON.parse(recipe.elaboration);

  return {
    ...this.formatRecipeResponse(recipe),
    elaboration: JSON.stringify(parsedElaboration), // Enviar como JSON string
  };
}
```

## Uso en Componentes

### 1. Inicialización en Componente

```typescript
export default function RecipesPage() {
  const [elaborationJson, setElaborationJson] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign,
      ListItem,
    ],
    content: '', // Contenido inicial
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      // Guardar JSON actualizado
      setElaborationJson(JSON.stringify(editor.getJSON()));
    },
  });

  // Cargar contenido de receta existente
  useEffect(() => {
    if (selectedRecipe?.elaboration) {
      const parsed = JSON.parse(selectedRecipe.elaboration);
      editor?.commands.setContent(parsed);
    }
  }, [selectedRecipe, editor]);

  // ... resto del componente
}
```

### 2. Envío a API

```typescript
const handleCreateRecipe = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  if (!editor) return;

  const recipeData = {
    name: formData.name,
    elaboration: JSON.stringify(editor.getJSON()), // Convertir a JSON string
    // ... otros campos
  };

  try {
    const response = await fetch('/api/v1/recipes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(recipeData),
    });

    // ... manejar respuesta
  } catch (error) {
    // ... manejar error
  }
};
```

## Estilos y Personalización

### Tailwind Integration

```typescript
// Clases de Tailwind para el editor
const editorClasses = {
  root: 'prose prose-sm sm:prose lg:prose-xl mx-auto focus:outline-none',
  toolbar: 'bg-gray-50 px-4 py-2 border-b flex space-x-2',
  button: 'px-3 py-1 rounded hover:bg-gray-200',
  buttonActive: 'px-3 py-1 rounded bg-indigo-600 text-white',
  content: 'prose max-w-none p-4 min-h-[200px] focus:outline-none',
};

// Uso en componente
<div className="border border-gray-300 rounded-md">
  <div className={editorClasses.toolbar}>
    {/* Botones del toolbar */}
  </div>
  <EditorContent editor={editor} className={editorClasses.content} />
</div>
```

### Custom Styling

```css
/* globals.css o módulo CSS */
.ProseMirror {
  outline: none;
  min-height: 200px;
  padding: 1rem;
}

.ProseMirror p.is-editor-empty:first-child::before {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.ProseMirror:focus {
  outline: none;
}

/* Estilos de lista */
.ProseMirror ul,
.ProseMirror ol {
  padding-left: 1.5rem;
}

.ProseMirror li {
  margin: 0.25rem 0;
}
```

## Funcionalidades Avanzadas

### 1. Placeholder Text

```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: 'Escribe las instrucciones de elaboración aquí...',
    }),
    // ... otras extensiones
  ],
});
```

### 2. Character Limit

```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    CharacterCount.configure({
      limit: 5000,
    }),
    // ... otras extensiones
  ],
  onUpdate: ({ editor }) => {
    const characterCount = editor.storage.characterCount.characters();
    if (characterCount >= 5000) {
      // Alertar al usuario
    }
  },
});
```

### 3. Image Upload (Futuro)

```typescript
import Image from '@tiptap/extension-image';

const editor = useEditor({
  extensions: [
    StarterKit,
    Image.configure({
      inline: true,
      allowBase64: true,
    }),
  ],
});
```

## Troubleshooting

### Problemas Comunes

**1. JSON Inválido:**
```typescript
// Error: "Elaboration must be valid TipTap JSON"
// Solución: Validar antes de enviar
try {
  JSON.parse(elaboration);
} catch (error) {
  console.error('Invalid JSON:', error);
}
```

**2. Contenido No Se Muestra:**
```typescript
// Error: Editor vacío después de cargar
// Solución: Parsear JSON antes de setear
const parsed = JSON.parse(recipe.elaboration);
editor?.commands.setContent(parsed);
```

**3. Estilos No Se Aplican:**
```typescript
// Error: Editor sin estilos
// Solución: Incluir Tailwind Typography
// npm install @tailwindcss/typography
// tailwind.config.js: plugins: [require('@tailwindcss/typography')]
```

## Performance Considerations

### 1. Debounce de Actualizaciones

```typescript
import { debounce } from 'lodash';

const debouncedUpdate = debounce((json: string) => {
  // Guardar en estado o enviar a API
  setElaborationJson(json);
}, 500);

const editor = useEditor({
  extensions: [StarterKit],
  onUpdate: ({ editor }) => {
    debouncedUpdate(JSON.stringify(editor.getJSON()));
  },
});
```

### 2. Lazy Loading de Recetas

```typescript
// Solo cargar elaboración cuando se abre la receta
const [elaborationLoaded, setElaborationLoaded] = useState(false);

const loadElaboration = async () => {
  if (!elaborationLoaded && selectedRecipe?.id) {
    const recipe = await fetchRecipe(selectedRecipe.id);
    const parsed = JSON.parse(recipe.elaboration);
    editor?.commands.setContent(parsed);
    setElaborationLoaded(true);
  }
};
```

## Documentación Relacionada

- [Recipe Data Model](./recipe-data-model.md) - Modelo de datos de recetas
- [Recursive Recipe System](./recursive-recipe-system.md) - Sistema de recetas recursivas
- [Cost Engine Algorithm](./cost-engine-algorithm.md) - Algoritmo de cálculo de costeos
- [TipTap Official Docs](https://tiptap.dev/introduction) - Documentación oficial de TipTap