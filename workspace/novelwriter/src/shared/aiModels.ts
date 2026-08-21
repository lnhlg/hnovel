// 推理模型判定：主进程与渲染进程共享的唯一来源，修改时两侧行为同步生效。
// 包括：OpenAI o1/o3/o4/gpt-5 系列、DeepSeek V4/R1 系列、含 reasoning/reasoner/thinking 关键字的模型。
// 推理模型固定采样：忽略 temperature/top_p；reasoning_effort 仅对这类模型发送。
export function isReasoningModel(model: string): boolean {
  const m = model.toLowerCase()
  return (
    /^(o1|o3|o4|gpt-5)/.test(m) ||
    /^deepseek-(v4|r1)/.test(m) ||
    m.includes('reasoning') ||
    m.includes('reasoner') ||
    m.includes('thinking')
  )
}
