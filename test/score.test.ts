import { describe, expect, it } from 'vitest'
import { calcScore } from '@/lib/score'

function score(noHouseYears: number, dependents: number, accountMonths: number) {
  return calcScore({ noHouseYears, dependents, accountMonths })
}

describe('calcScore — 무주택기간', () => {
  it.each([
    [0, 2],
    [1, 4],
    [14, 30],
    [15, 32],
    [20, 32], // 상한
  ])('%i년이면 %i점이다', (years, expected) => {
    expect(score(years, 0, 0).breakdown.noHouse).toBe(expected)
  })
})

describe('calcScore — 부양가족수', () => {
  it.each([
    [0, 5],
    [1, 10],
    [5, 30],
    [6, 35],
    [10, 35], // 상한
  ])('%i명이면 %i점이다', (dependents, expected) => {
    expect(score(0, dependents, 0).breakdown.dependents).toBe(expected)
  })
})

describe('calcScore — 청약통장 가입기간', () => {
  it.each([
    [0, 1],
    [5, 1],
    [6, 2],
    [11, 2],
    [12, 3],
    [24, 4],
    [179, 16], // 14년 11개월
    [180, 17], // 15년
    [300, 17], // 상한
  ])('%i개월이면 %i점이다', (months, expected) => {
    expect(score(0, 0, months).breakdown.account).toBe(expected)
  })
})

describe('calcScore — 총점', () => {
  it('만점(15년/6명/180개월)이면 84점이다', () => {
    const result = score(15, 6, 180)
    expect(result.total).toBe(84)
    expect(result.breakdown).toEqual({ noHouse: 32, dependents: 35, account: 17 })
  })
})

// 음수·비정수 입력 — 폼에서 막을 수 있지만 순수 함수 자체의 동작을 정해서 고정한다.
describe('calcScore — 경계 밖 입력', () => {
  it('음수는 최저 구간과 같은 점수로 떨어진다', () => {
    expect(score(-1, -1, -1).breakdown).toEqual({ noHouse: 2, dependents: 5, account: 1 })
  })

  it('비정수는 내림 구간의 점수를 따른다(다음 구간 미만이면 이전 구간 유지)', () => {
    expect(score(14.9, 5.9, 11.9).breakdown).toEqual({ noHouse: 30, dependents: 30, account: 2 })
  })
})
