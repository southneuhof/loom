export type Label = string | (() => string)

export type LabelDictionary = Readonly<Record<string, Label | undefined>>
