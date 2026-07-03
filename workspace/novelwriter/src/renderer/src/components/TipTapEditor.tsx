import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'

interface TipTapEditorProps {
  content: string
  onUpdate: (html: string) => void
  placeholder?: string
}

const sBtn = (active: boolean): React.CSSProperties => ({
  borderRadius: 'var(--radius-sm)',
  padding: '3px 6px',
  fontSize: '11px',
  fontWeight: 500,
  cursor: 'pointer',
  border: 'none',
  background: active ? 'var(--color-active)' : 'transparent',
  color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
  transition: 'all var(--transition-fast)',
})

function MenuBar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '2px',
        borderBottom: '1px solid var(--color-border)',
        padding: '6px 12px',
      }}
    >
      <select
        onChange={(e) => {
          const val = e.target.value
          if (val === 'paragraph') editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: Number(val) as 1 | 2 | 3 }).run()
          e.target.value = ''
        }}
        style={{
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          padding: '3px 6px',
          fontSize: '11px',
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          marginRight: '4px',
        }}
        defaultValue=""
      >
        <option value="" disabled>段落</option>
        <option value="paragraph">正文</option>
        <option value="1">标题 1</option>
        <option value="2">标题 2</option>
        <option value="3">标题 3</option>
      </select>

      <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }} />

      <button onClick={() => editor.chain().focus().toggleBold().run()} style={sBtn(editor.isActive('bold'))} title="加粗">
        <strong>B</strong>
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} style={sBtn(editor.isActive('italic'))} title="斜体">
        <em>I</em>
      </button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} style={sBtn(editor.isActive('underline'))} title="下划线">
        <span style={{ textDecoration: 'underline' }}>U</span>
      </button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} style={sBtn(editor.isActive('strike'))} title="删除线">
        <span style={{ textDecoration: 'line-through' }}>S</span>
      </button>

      <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }} />

      <button onClick={() => editor.chain().focus().toggleBulletList().run()} style={sBtn(editor.isActive('bulletList'))} title="无序列表">
        •列表
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} style={sBtn(editor.isActive('orderedList'))} title="有序列表">
        1.列表
      </button>

      <div style={{ width: 1, height: 16, background: 'var(--color-border)', margin: '0 4px' }} />

      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} style={sBtn(editor.isActive('blockquote'))} title="引用">
        ❝
      </button>
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} style={sBtn(editor.isActive('codeBlock'))} title="代码块">
        {'</>'}
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        style={{
          ...sBtn(false),
          padding: '3px 6px',
        }}
        title="分隔线"
      >
        ―
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          style={{ ...sBtn(false), opacity: editor.can().undo() ? 1 : 0.3, cursor: editor.can().undo() ? 'pointer' : 'not-allowed' }}
          title="撤销"
        >
          ↩
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          style={{ ...sBtn(false), opacity: editor.can().redo() ? 1 : 0.3, cursor: editor.can().redo() ? 'pointer' : 'not-allowed' }}
          title="重做"
        >
          ↪
        </button>
      </div>
    </div>
  )
}

function TipTapEditor({ content, onUpdate, placeholder }: TipTapEditorProps): JSX.Element {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      Placeholder.configure({
        placeholder: placeholder ?? '开始创作你的小说...'
      })
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onUpdate(html)
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[60vh] px-6 py-4 text-base leading-relaxed'
      }
    }
  })

  React.useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, false)
    }
  }, [editor, content])

  if (!editor) {
    return <div style={{ padding: 24, color: 'var(--color-text-dim)', fontSize: 13 }}>加载编辑器...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <MenuBar editor={editor} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        <EditorContent editor={editor} style={{ height: '100%' }} />
      </div>
    </div>
  )
}

export default TipTapEditor
