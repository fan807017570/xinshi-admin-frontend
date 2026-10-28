<template>
  <section class="page class-stats-page">
    <header class="stats-masthead">
      <div class="stats-masthead__copy">
        <p class="stats-kicker">Class Analytics</p>
        <h1>班级成绩统计</h1>
        <p class="stats-masthead__lead">按学期、班级与考试类型统计成绩表现，从整体分数到各科分布，再到学生排名与偏科线索。</p>
      </div>
      <div class="stats-masthead__stamp" aria-label="当前统计口径">
        <span>当前口径</span>
        <strong>{{ scoreModeLabel }}</strong>
        <small>及格线 60% · 优秀线 90%</small>
      </div>
    </header>

    <section class="stats-filter-panel" aria-label="成绩统计查询条件">
      <div class="stats-filter-panel__head">
        <div>
          <span class="section-index">01</span>
          <h2>锁定一次考试</h2>
          <p>先确定范围，统计结果会沿用同一套口径。</p>
        </div>
        <span class="stats-filter-panel__hint">所有条件均为服务端聚合</span>
      </div>
      <div class="stats-filter-grid">
        <label class="stats-field">
          <span>学期</span>
          <select v-model="query.academicTermId">
            <option value="">选择学期</option>
            <option v-for="t in terms" :key="t.id" :value="t.id">{{ t.termName || t.name }}</option>
          </select>
        </label>
        <label class="stats-field">
          <span>届次</span>
          <select v-model="query.gradeSession" @change="onSessionChange">
            <option value="">全部届次</option>
            <option v-for="session in sessionOptions" :key="session" :value="session">{{ session }}届</option>
          </select>
        </label>
        <label class="stats-field">
          <span>班级</span>
          <select v-model="query.classId">
            <option value="">选择班级</option>
            <option v-for="c in availableClasses" :key="c.id" :value="c.id">{{ c.className || c.name }}</option>
          </select>
        </label>
        <label class="stats-field">
          <span>考试类型</span>
          <select v-model="query.examTypeId">
            <option value="">选择考试类型</option>
            <option v-for="et in examTypes" :key="et.id" :value="et.id">{{ et.examTypeName || et.name }}</option>
          </select>
        </label>
        <label class="stats-field stats-field--mode">
          <span>计分方式</span>
          <select v-model="query.scoreMode">
            <option value="Raw">原始分</option>
            <option value="Scaled100">百分制折算</option>
          </select>
        </label>
        <button
          class="stats-query-button"
          type="button"
          :disabled="loading || !canQuery"
          @click="executeQuery"
        >
          <span>{{ loading ? '正在整理数据' : '生成分析' }}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </button>
      </div>
      <p class="stats-filter-panel__foot">{{ activeTab === 'compare' ? '班级对比需要选择届次；其余视图需要选择具体班级。' : '班级成绩将按所选考试类型单独统计。' }}</p>
    </section>

    <p v-if="error" class="stats-error" role="alert">{{ error }}</p>

    <div class="stats-workspace">
      <nav class="stats-tabs" aria-label="统计视图" role="tablist">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.key"
          class="stats-tab"
          :class="{ 'stats-tab--active': activeTab === tab.key }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          @click="switchTab(tab.key)"
        >
          <span class="stats-tab__index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <main class="stats-content">
        <template v-if="activeTab === 'overview'">
          <div v-if="showIdle" class="stats-empty">
            <span class="stats-empty__mark">📊</span>
            <h2>先选一场考试</h2>
            <p>选择学期、班级和考试类型，班级成绩脉搏会在这里展开。</p>
          </div>
          <div v-else-if="reportEmpty" class="stats-empty">
            <span class="stats-empty__mark">📉</span>
            <h2>这场考试还没有成绩</h2>
            <p>先去成绩管理录入数据，再回来生成班级分析。</p>
          </div>
          <template v-else-if="report">
            <section class="score-pulse">
              <div class="score-pulse__topline">
                <div>
                  <span class="section-index section-index--light">02</span>
                  <p class="score-pulse__label">班级成绩脉搏</p>
                  <h2>{{ report.className || '当前班级' }}</h2>
                </div>
                <div class="score-pulse__context">
                  <span>{{ selectedTermName }}</span>
                  <span>{{ selectedExamTypeName }}</span>
                  <span>{{ report.studentCount }} 位学生</span>
                </div>
              </div>
              <div class="score-pulse__body">
                <div class="score-pulse__primary">
                  <span>综合平均分</span>
                  <strong>{{ formatMark(report.totalAvg) }}</strong>
                  <div class="pulse-meter" aria-label="各科平均达成率">
                    <span :style="{ width: averageSubjectRate + '%' }"></span>
                  </div>
                  <div class="pulse-meter__labels">
                    <span>各科平均达成率</span>
                    <strong>{{ averageSubjectRate }}%</strong>
                  </div>
                </div>
                <div class="score-pulse__metrics">
                  <div>
                    <span>总分中位数</span>
                    <strong>{{ formatMark(report.totalMedian) }}</strong>
                  </div>
                  <div>
                    <span>平均及格率</span>
                    <strong>{{ averagePassRate }}%</strong>
                  </div>
                  <div>
                    <span>成绩条数</span>
                    <strong>{{ report.resultCount }}</strong>
                  </div>
                  <div>
                    <span>需要关注</span>
                    <strong>{{ attentionCount }}</strong>
                  </div>
                </div>
              </div>
              <div class="score-pulse__bottomline">
                <span>最高达成科目 <strong>{{ strongestSubject?.subjectName || '-' }}</strong></span>
                <span>最低达成科目 <strong>{{ weakestSubject?.subjectName || '-' }}</strong></span>
                <span>{{ report.subjectCount }} 门课程参与统计</span>
              </div>
            </section>

            <section class="overview-grid">
              <article class="insight-panel">
                <div class="content-heading">
                  <div>
                    <span class="section-index">03</span>
                    <h2>这次成绩告诉我们</h2>
                  </div>
                  <span class="content-heading__note">先看信号，再看明细</span>
                </div>
                <div class="insight-list">
                  <div class="insight-item insight-item--positive">
                    <span class="insight-item__dot"></span>
                    <div><span>优势科目</span><strong>{{ strongestSubject?.subjectName || '暂无' }}</strong></div>
                    <em>{{ strongestSubject ? subjectRate(strongestSubject) : 0 }}%</em>
                  </div>
                  <div class="insight-item insight-item--watch">
                    <span class="insight-item__dot"></span>
                    <div><span>优先复盘</span><strong>{{ weakestSubject?.subjectName || '暂无' }}</strong></div>
                    <em>{{ weakestSubject ? subjectRate(weakestSubject) : 0 }}%</em>
                  </div>
                  <div class="insight-item">
                    <span class="insight-item__dot"></span>
                    <div><span>偏科线索</span><strong>{{ attentionCount ? `发现 ${attentionCount} 条` : '暂未发现' }}</strong></div>
                    <em>查看</em>
                  </div>
                </div>
              </article>
              <article class="route-panel">
                <div class="content-heading">
                  <div>
                    <span class="section-index">04</span>
                    <h2>继续往下读</h2>
                  </div>
                </div>
                <button class="route-link" type="button" @click="switchTab('subjects')">
                  <span><strong>各科统计与分布</strong><small>看均分、分布和离散度</small></span><b>→</b>
                </button>
                <button class="route-link" type="button" @click="switchTab('ranking')">
                  <span><strong>学生排名</strong><small>从总分回到每个学生</small></span><b>→</b>
                </button>
                <button class="route-link" type="button" @click="switchTab('weakness')">
                  <span><strong>偏科分析</strong><small>找出高总分下的短板</small></span><b>→</b>
                </button>
              </article>
            </section>

            <section class="subject-snapshot">
              <div class="content-heading">
                <div><span class="section-index">05</span><h2>学科达成率</h2></div>
                <button class="text-action" type="button" @click="switchTab('subjects')">查看完整科目表 →</button>
              </div>
              <div class="subject-rail">
                <div v-for="stat in report.subjectStats" :key="'snapshot-' + stat.subjectId" class="subject-rail__row">
                  <strong>{{ stat.subjectName }}</strong>
                  <div class="subject-rail__track"><span :style="{ width: subjectRate(stat) + '%' }"></span></div>
                  <span>{{ subjectRate(stat) }}%</span>
                  <small>均分 {{ formatMark(stat.avgScore) }}</small>
                </div>
              </div>
            </section>
          </template>
        </template>

        <template v-else-if="activeTab === 'subjects'">
          <div v-if="showIdle" class="stats-empty"><span class="stats-empty__mark">📊</span><h2>先选一场考试</h2><p>选择学期、班级和考试类型，查看每门课的表现。</p></div>
          <div v-else-if="reportEmpty" class="stats-empty"><span class="stats-empty__mark">📉</span><h2>没有可分析的科目</h2><p>该班级暂无成绩数据，请先录入成绩。</p></div>
          <template v-else-if="report">
            <section class="section-block">
              <div class="content-heading content-heading--wide">
                <div><span class="section-index">02</span><h2>科目横向比较</h2><p>用满分归一后的达成率，快速看出学科落差。</p></div>
                <div class="legend"><span><i class="legend-dot legend-dot--teal"></i>达成率</span><span><i class="legend-dot legend-dot--coral"></i>低分率</span></div>
              </div>
              <div class="subject-compare-list">
                <div v-for="stat in report.subjectStats" :key="'compare-' + stat.subjectId" class="subject-compare-row">
                  <div class="subject-compare-row__name"><strong>{{ stat.subjectName }}</strong><span>满分 {{ stat.maxScore }}</span></div>
                  <div class="subject-compare-row__bar"><span :style="{ width: subjectRate(stat) + '%' }"></span></div>
                  <strong class="subject-compare-row__score">{{ subjectRate(stat) }}%</strong>
                  <div class="subject-compare-row__rates"><span>及格 {{ stat.passRate }}%</span><span>优秀 {{ stat.excellentRate }}%</span><span class="is-alert">低分 {{ stat.lowRate }}%</span></div>
                </div>
              </div>
            </section>
            <section class="section-block">
              <div class="content-heading"><div><span class="section-index">03</span><h2>科目统计明细</h2></div><span class="content-heading__note">分数越低，波动越值得关注</span></div>
              <div class="table-wrap stats-table-wrap">
                <table class="stats-table">
                  <thead><tr><th>科目</th><th>满分</th><th>平均分</th><th>中位数</th><th>标准差</th><th>最高</th><th>最低</th><th>及格率</th><th>优秀率</th><th>低分率</th></tr></thead>
                  <tbody>
                    <tr v-for="stat in report.subjectStats" :key="stat.subjectId">
                      <td><strong>{{ stat.subjectName }}</strong></td><td>{{ stat.maxScore }}</td><td>{{ formatMark(stat.avgScore) }}</td><td>{{ formatMark(stat.medianScore) }}</td><td>{{ formatMark(stat.stdDev) }}</td><td>{{ formatMark(stat.maxResult) }}</td><td>{{ formatMark(stat.minResult) }}</td>
                      <td><span :class="passRateClass(stat.passRate)">{{ stat.passRate }}%</span></td><td><span class="rate-chip rate-chip--good">{{ stat.excellentRate }}%</span></td><td><span class="rate-chip rate-chip--low">{{ stat.lowRate }}%</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="stats-note">及格线为满分的 60%，优秀线为满分的 90%，低分线为满分的 40%。</p>
            </section>
            <section class="section-block distribution-block">
              <div class="content-heading"><div><span class="section-index">04</span><h2>分数分布</h2><p>每根柱子代表 5 分区间，观察成绩集中在哪一段。</p></div></div>
              <div class="chart-grid">
                <div v-for="stat in report.subjectStats" :key="'chart-' + stat.subjectId" class="chart-card">
                  <div class="chart-card__head"><strong>{{ stat.subjectName }}</strong><span>平均 {{ formatMark(stat.avgScore) }}</span></div>
                  <svg :viewBox="'0 0 ' + chartWidth + ' ' + chartHeight" class="chart-svg" role="img" :aria-label="stat.subjectName + '分数分布'">
                    <line :x1="chartPlotLeft" :x2="chartPlotLeft + chartPlotWidth" :y1="chartPlotTop + chartPlotHeight" :y2="chartPlotTop + chartPlotHeight" class="chart-axis-line" />
                    <text v-for="(label, i) in chartYLabels(stat)" :key="'y-' + i" :x="chartYLabelX" :y="chartYPos(i, chartYLabels(stat).length)" class="chart-axis-label" text-anchor="end">{{ label }}</text>
                    <g v-for="(bucket, bi) in stat.buckets" :key="'bar-' + bi">
                      <rect :x="barX(bi)" :y="barTop(stat, bucket.count)" :width="barWidth" :height="barHeight(stat, bucket.count)" class="chart-bar" />
                      <text v-if="bucket.count > 0" :x="barX(bi) + barWidth / 2" :y="barTop(stat, bucket.count) - 4" class="chart-bar-label" text-anchor="middle">{{ bucket.count }}</text>
                      <text v-if="bi % labelSkip(stat) === 0 || bi === stat.buckets.length - 1" :x="barX(bi) + barWidth / 2" :y="chartHeight - 4" class="chart-axis-label" text-anchor="middle">{{ bucket.label }}</text>
                    </g>
                  </svg>
                </div>
              </div>
            </section>
          </template>
        </template>

        <template v-else-if="activeTab === 'compare'">
          <div v-if="!compareRows.length && !loading" class="stats-empty"><span class="stats-empty__mark">📊</span><h2>先选一届考试</h2><p>选择学期、届次和考试类型，比较同届班级的成绩表现。</p><small>对比默认采用百分制折算，避免不同科目满分差异影响判断。</small></div>
          <template v-else-if="compareRows.length">
            <section class="compare-hero">
              <div><span class="section-index section-index--light">02</span><p>同届班级横向快照</p><h2>{{ query.gradeSession }}届 · {{ selectedExamTypeName }}</h2></div>
              <div class="compare-hero__winner"><span>当前领先</span><strong>{{ topCompareRow?.className || '-' }}</strong><b>{{ topCompareRow ? formatMark(topCompareRow.totalAvg) : '-' }}</b></div>
            </section>
            <section class="section-block">
              <div class="content-heading content-heading--wide"><div><span class="section-index">03</span><h2>班级排行榜</h2><p>按{{ query.scoreMode === 'Scaled100' ? '百分制折算' : '原始分加总' }}的综合平均分排序。</p></div><span class="content-heading__note">{{ compareRows.length }} 个班级参与</span></div>
              <div class="leaderboard">
                <div v-for="item in compareRows" :key="item.classId" class="leaderboard-row" :class="{ 'leaderboard-row--first': item.rank === 1 }">
                  <span class="leaderboard-row__rank">{{ String(item.rank).padStart(2, '0') }}</span>
                  <div class="leaderboard-row__class"><strong>{{ item.className }}</strong><span>{{ item.studentCount }} 人 · 及格 {{ item.passRate }}%</span></div>
                  <div class="leaderboard-row__bar"><span :style="{ width: (Number(item.totalAvg) / compareMaxAvg() * 100) + '%' }"></span></div>
                  <strong class="leaderboard-row__score">{{ formatMark(item.totalAvg) }}</strong>
                  <span class="rate-chip rate-chip--good">优 {{ item.excellentRate }}%</span>
                </div>
              </div>
              <p class="stats-note">口径：{{ query.scoreMode === 'Scaled100' ? '百分制折算（各科先折算为 100 分制再加总）' : '原始分加总' }}；及格率/优秀率按全科人次统计。</p>
            </section>
            <section class="section-block distribution-block">
              <div class="content-heading"><div><span class="section-index">04</span><h2>总分平均排名</h2></div></div>
              <svg :viewBox="'0 0 ' + compareChartWidth + ' ' + compareChartHeight" class="compare-chart" role="img" aria-label="班级总分平均排名">
                <g v-for="(item, i) in compareRows" :key="'compare-bar-' + item.classId">
                  <text :x="0" :y="i * 36 + 22" class="compare-chart-label">{{ item.rank }}. {{ item.className }}</text>
                  <rect :x="150" :y="i * 36 + 8" :width="compareBarWidth(Number(item.totalAvg))" :height="20" class="compare-chart-bar" />
                  <text :x="150 + compareBarWidth(Number(item.totalAvg)) + 6" :y="i * 36 + 22" class="compare-chart-value">{{ formatMark(item.totalAvg) }}</text>
                </g>
              </svg>
            </section>
          </template>
        </template>

        <template v-else-if="activeTab === 'ranking'">
          <div v-if="showIdle" class="stats-empty"><span class="stats-empty__mark">📊</span><h2>先选一场考试</h2><p>选择学期、班级和考试类型，查看学生总分排名。</p></div>
          <div v-else-if="reportEmpty" class="stats-empty"><span class="stats-empty__mark">📉</span><h2>还没有学生成绩</h2><p>该班级暂无成绩数据，请先录入成绩。</p></div>
          <template v-else-if="report">
            <section class="section-block">
              <div class="content-heading content-heading--wide"><div><span class="section-index">02</span><h2>学生总分排名</h2><p>总分口径：{{ scoreModeLabel }}；并列时取相同名次。</p></div><span class="content-heading__note">{{ report.ranking.length }} 位学生</span></div>
              <div class="podium" v-if="report.ranking.length">
                <article v-for="item in report.ranking.slice(0, 3)" :key="'podium-' + item.studentId" class="podium-card" :class="'podium-card--' + item.rank">
                  <span class="podium-card__rank">{{ String(item.rank).padStart(2, '0') }}</span>
                  <strong>{{ item.studentName }}</strong>
                  <span>{{ formatMark(item.totalScore) }} 分</span>
                </article>
              </div>
              <div class="table-wrap stats-table-wrap">
                <table class="stats-table ranking-table">
                  <thead><tr><th>名次</th><th>学生</th><th>总分</th><th>各科成绩</th></tr></thead>
                  <tbody>
                    <tr v-for="item in report.ranking" :key="item.studentId">
                      <td><span class="rank-badge" :class="{ 'rank-badge--top': item.rank === 1 }">{{ item.rank }}</span></td><td><strong>{{ item.studentName }}</strong></td><td class="score-cell">{{ formatMark(item.totalScore) }}</td>
                      <td><span v-for="subject in item.subjects" :key="subject.subjectId" class="subject-score-tag">{{ subject.subjectName }} {{ formatMark(subject.score) }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>
        </template>

        <template v-else>
          <div v-if="showIdle" class="stats-empty"><span class="stats-empty__mark">📊</span><h2>先选一场考试</h2><p>选择学期、班级和考试类型，定位班级里的偏科线索。</p></div>
          <div v-else-if="reportEmpty" class="stats-empty"><span class="stats-empty__mark">📉</span><h2>还没有足够数据</h2><p>该班级暂无成绩数据，请先录入成绩。</p></div>
          <template v-else-if="report">
            <section v-if="report.forwardWeakness.length" class="section-block weakness-block">
              <div class="content-heading content-heading--wide"><div><span class="section-index">02</span><h2>高总分下的短板</h2><p>总分高于班级平均，但单科表现明显落后。</p></div><span class="content-heading__note">{{ report.forwardWeakness.length }} 条线索</span></div>
              <div class="table-wrap stats-table-wrap"><table class="stats-table"><thead><tr><th>学生</th><th>总分</th><th>薄弱科目</th><th>得分</th><th>该科平均</th><th>差距</th></tr></thead><tbody><tr v-for="w in report.forwardWeakness" :key="'fw-' + w.studentId + '-' + w.weakSubjectName"><td><strong>{{ w.studentName }}</strong></td><td>{{ formatMark(w.totalScore) }}</td><td>{{ w.weakSubjectName }}</td><td>{{ formatMark(w.score) }}</td><td>{{ formatMark(w.subjectAvg) }}</td><td class="gap-cell gap-negative">-{{ formatMark(w.gap) }}</td></tr></tbody></table></div>
            </section>
            <section v-if="report.reverseWeakness.length" class="section-block weakness-block">
              <div class="content-heading content-heading--wide"><div><span class="section-index">03</span><h2>低总分里的亮点</h2><p>总分低于班级平均，但单科表现有明显优势。</p></div><span class="content-heading__note">{{ report.reverseWeakness.length }} 条线索</span></div>
              <div class="table-wrap stats-table-wrap"><table class="stats-table"><thead><tr><th>学生</th><th>总分</th><th>突出科目</th><th>得分</th><th>该科平均</th><th>超出</th></tr></thead><tbody><tr v-for="w in report.reverseWeakness" :key="'rw-' + w.studentId + '-' + w.strongSubjectName"><td><strong>{{ w.studentName }}</strong></td><td>{{ formatMark(w.totalScore) }}</td><td>{{ w.strongSubjectName }}</td><td>{{ formatMark(w.score) }}</td><td>{{ formatMark(w.subjectAvg) }}</td><td class="gap-cell gap-positive">+{{ formatMark(w.gap) }}</td></tr></tbody></table></div>
            </section>
            <div v-if="!report.forwardWeakness.length && !report.reverseWeakness.length" class="stats-empty stats-empty--compact"><span class="stats-empty__mark">✅</span><h2>暂未发现显著偏科</h2><p>这次成绩的学科表现相对均衡，可以继续关注下一次考试变化。</p></div>
          </template>
        </template>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import * as schoolApi from '../api/school'

// ---- Types ----

type AnyRow = Record<string, any>

type StatsTabKey = 'overview' | 'subjects' | 'compare' | 'ranking' | 'weakness'

interface ScoreBucket {
  label: string
  min: number
  max: number
  count: number
  percent: number
}

interface SubjectStats {
  subjectId: number
  subjectCode?: string
  subjectName: string
  minScore: number
  maxScore: number
  avgScore: number
  medianScore: number
  stdDev: number
  maxResult: number
  minResult: number
  passLine: number
  passRate: number
  excellentRate: number
  lowRate: number
  totalStudents: number
  buckets: ScoreBucket[]
}

interface WeaknessItem {
  studentId: number
  studentName: string
  totalScore: number
  weakSubjectName?: string
  strongSubjectName?: string
  score: number
  subjectAvg: number
  gap: number
}

interface RankingSubject {
  subjectId: number
  subjectCode?: string
  subjectName: string
  score: number
}

interface RankingItem {
  rank: number
  studentId: number
  studentName: string
  totalScore: number
  subjects: RankingSubject[]
}

interface ClassScoreReport {
  classId: number
  className: string
  academicTermId: number
  examTypeId: number
  scoreMode: string
  resultCount: number
  studentCount: number
  subjectCount: number
  totalAvg: number
  totalMedian: number
  subjectStats: SubjectStats[]
  forwardWeakness: WeaknessItem[]
  reverseWeakness: WeaknessItem[]
  ranking: RankingItem[]
}

interface ClassCompareRow {
  classId: number
  className: string
  studentCount: number
  totalAvg: number
  passRate: number
  excellentRate: number
  rank: number
}

// ---- Constants ----

const tabs: Array<{ key: StatsTabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'subjects', label: '各科统计与分布' },
  { key: 'compare', label: '班级对比' },
  { key: 'ranking', label: '学生排名' },
  { key: 'weakness', label: '偏科分析' }
]

// ---- Chart Constants ----

const chartWidth = 460
const chartHeight = 160
const chartMarginLeft = 32
const chartMarginRight = 12
const chartMarginTop = 18
const chartMarginBottom = 24
const chartPlotLeft = chartMarginLeft
const chartPlotWidth = chartWidth - chartMarginLeft - chartMarginRight
const chartPlotTop = chartMarginTop
const chartPlotHeight = chartHeight - chartMarginTop - chartMarginBottom
const chartYLabelX = chartMarginLeft - 4

const compareChartWidth = 560
const compareChartRowHeight = 36

// ---- Helpers ----

const payload = (res: any) => res?.data?.data ?? res?.data ?? res ?? {}
const rows = (value: any): AnyRow[] => {
  const data = payload(value)
  if (Array.isArray(data)) return data
  return data.items || data.records || data.list || data.content || []
}
const call = async (name: string, ...params: any[]) => {
  const fn = (schoolApi as AnyRow)[name]
  return fn ? fn(...params) : []
}

// ---- State ----

const terms = ref<AnyRow[]>([])
const classes = ref<AnyRow[]>([])
const examTypes = ref<AnyRow[]>([])
const filterOptions = ref<AnyRow>({})
const loading = ref(false)
const error = ref('')
const report = ref<ClassScoreReport | null>(null)
const compareRows = ref<ClassCompareRow[]>([])
const activeTab = ref<StatsTabKey>('overview')

const query = reactive({
  academicTermId: '',
  gradeSession: '',
  classId: '',
  examTypeId: '',
  scoreMode: 'Raw' as 'Raw' | 'Scaled100'
})

const sessionOptions = computed(() => (filterOptions.value.gradeSessions || []).map((item: any) => String(item)))
const latestSession = computed(() => sessionOptions.value[0] || '')
const availableClasses = computed(() =>
  query.gradeSession
    ? classes.value.filter((item) => String(item.gradeSession ?? '') === String(query.gradeSession))
    : classes.value
)

const canQuery = computed(() => {
  if (!query.academicTermId || !query.examTypeId) return false
  return activeTab.value === 'compare' ? Boolean(query.gradeSession) : Boolean(query.classId)
})

const showIdle = computed(() => !loading.value && !error.value && !report.value && !compareRows.value.length)
const reportEmpty = computed(() => Boolean(report.value && report.value.subjectStats.length === 0))
const scoreModeLabel = computed(() => query.scoreMode === 'Scaled100' ? '百分制折算' : '原始分加总')
const selectedTermName = computed(() => {
  const item = terms.value.find((term) => String(term.id) === String(query.academicTermId))
  return item?.termName || item?.name || '未选择学期'
})
const selectedExamTypeName = computed(() => {
  const item = examTypes.value.find((exam) => String(exam.id) === String(query.examTypeId))
  return item?.examTypeName || item?.name || '未选择考试'
})
const averageSubjectRate = computed(() => {
  const stats = report.value?.subjectStats || []
  return stats.length ? Math.round(stats.reduce((sum, stat) => sum + subjectRate(stat), 0) / stats.length) : 0
})
const averagePassRate = computed(() => {
  const stats = report.value?.subjectStats || []
  return stats.length ? Math.round(stats.reduce((sum, stat) => sum + Number(stat.passRate || 0), 0) / stats.length) : 0
})
const attentionCount = computed(() => {
  const items = [...(report.value?.forwardWeakness || []), ...(report.value?.reverseWeakness || [])]
  return new Set(items.map((item) => item.studentId)).size
})
const strongestSubject = computed<SubjectStats | null>(() => {
  const stats = report.value?.subjectStats || []
  return stats.length ? stats.reduce((best, stat) => subjectRate(stat) > subjectRate(best) ? stat : best) : null
})
const weakestSubject = computed<SubjectStats | null>(() => {
  const stats = report.value?.subjectStats || []
  return stats.length ? stats.reduce((weakest, stat) => subjectRate(stat) < subjectRate(weakest) ? stat : weakest) : null
})
const topCompareRow = computed<ClassCompareRow | null>(() => compareRows.value[0] || null)

// ---- Lifecycle ----

onMounted(async () => {
  try {
    const [termRes, classRes, examRes, filterRes] = await Promise.all([
      call('listAcademicTerms').catch(() => []),
      call('listClasses', { page: 1, size: 200 }).catch(() => []),
      call('listExamTypes').catch(() => []),
      call('listClassFilterOptions').catch(() => ({}))
    ])
    terms.value = rows(termRes)
    classes.value = rows(classRes)
    examTypes.value = rows(examRes)
    filterOptions.value = payload(filterRes) || {}
    query.gradeSession = latestSession.value
  } catch {
    // silently ignore base data load failures; query will show errors
  }
})

// ---- Event handlers ----

function onSessionChange() {
  query.classId = ''
}

function switchTab(key: StatsTabKey) {
  activeTab.value = key
  if (key === 'compare') {
    if (query.scoreMode === 'Raw') {
      query.scoreMode = 'Scaled100'
    }
    // 条件齐备且尚无对比数据时自动查询
    if (!compareRows.value.length && query.academicTermId && query.gradeSession && query.examTypeId && !loading.value) {
      executeQuery()
    }
  }
}

async function executeQuery() {
  if (!canQuery.value || loading.value) return

  loading.value = true
  error.value = ''

  try {
    if (activeTab.value === 'compare') {
      compareRows.value = rows(await call('getClassStatsCompare', {
        academicTermId: Number(query.academicTermId),
        gradeSession: query.gradeSession,
        examTypeId: Number(query.examTypeId),
        scoreMode: query.scoreMode
      })) as unknown as ClassCompareRow[]
    } else {
      report.value = payload(await call('getClassStatsReport', {
        academicTermId: Number(query.academicTermId),
        classId: Number(query.classId),
        examTypeId: Number(query.examTypeId),
        scoreMode: query.scoreMode
      })) as ClassScoreReport
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '查询失败'
  } finally {
    loading.value = false
  }
}

// ---- Formatting ----

function formatMark(value: number): string {
  if (!Number.isFinite(value)) return '-'
  if (value === Math.floor(value)) return String(Math.floor(value))
  return value.toFixed(1)
}

function passRateClass(rate: number): string {
  if (rate >= 90) return 'pass-rate-good'
  if (rate >= 60) return 'pass-rate-ok'
  return 'pass-rate-low'
}

function subjectRate(stat: SubjectStats): number {
  const maxScore = Number(stat.maxScore)
  const avgScore = Number(stat.avgScore)
  if (!Number.isFinite(maxScore) || maxScore <= 0 || !Number.isFinite(avgScore)) return 0
  return Math.max(0, Math.min(100, Math.round(avgScore / maxScore * 100)))
}

// ---- Chart helpers ----

function chartMaxCount(stat: SubjectStats): number {
  const max = Math.max(...stat.buckets.map(b => b.count), 1)
  return Math.ceil(max / 5) * 5 + 5 // round up with padding
}

function chartYLabels(stat: SubjectStats): string[] {
  const max = chartMaxCount(stat)
  const step = Math.max(1, Math.ceil(max / 4))
  const labels: string[] = []
  for (let v = 0; v <= max; v += step) {
    labels.push(String(v))
  }
  return labels
}

function chartYPos(labelIndex: number, totalLabels: number): number {
  const maxIdx = totalLabels > 1 ? totalLabels - 1 : 1
  const frac = labelIndex / maxIdx
  return chartPlotTop + chartPlotHeight * (1 - frac)
}

const barGap = 2

function computeBarWidth(): number {
  if (!report.value) return 14
  const maxBuckets = Math.max(...report.value.subjectStats.map(s => s.buckets.length), 1)
  const available = chartPlotWidth - (maxBuckets - 1) * barGap
  return Math.max(6, Math.min(22, available / maxBuckets))
}

const barWidth = computed(() => computeBarWidth())

function barX(index: number): number {
  return chartPlotLeft + index * (barWidth.value + barGap)
}

function barTop(stat: SubjectStats, count: number): number {
  const maxC = chartMaxCount(stat)
  const frac = maxC > 0 ? count / maxC : 0
  return chartPlotTop + chartPlotHeight * (1 - frac)
}

function barHeight(stat: SubjectStats, count: number): number {
  const top = barTop(stat, count)
  return chartPlotTop + chartPlotHeight - top
}

function labelSkip(stat: SubjectStats): number {
  const n = stat.buckets.length
  if (n <= 8) return 1
  if (n <= 16) return 2
  return 3
}

function compareMaxAvg(): number {
  return Math.max(...compareRows.value.map((item) => Number(item.totalAvg) || 0), 1)
}

function compareBarWidth(avg: number): number {
  return Math.max(4, Math.round((avg / compareMaxAvg()) * 300))
}

const compareChartHeight = computed(() => Math.max(compareRows.value.length * compareChartRowHeight + 16, 52))
</script>

<style scoped>
/* —— 与全站一致的设计 token（青绿 + 白卡 + slate）—— */
.class-stats-page {
  --ink: #0f172a;
  --ink-soft: #334155;
  --muted: #64748b;
  --faint: #94a3b8;
  --line: #e2e8f0;
  --teal: #0f766e;
  --teal-soft: #ecfdf5;
  --teal-tint: #f0fdf9;
  --red: #dc2626;
  --red-soft: #fee2e2;
  --amber: #b45309;
  --amber-soft: #fef3c7;
  display: grid;
  gap: 18px;
}

/* —— 页头 —— */
.stats-masthead {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 2px;
}
.stats-masthead__copy {
  min-width: 0;
}
.stats-kicker {
  margin: 0 0 6px;
  color: var(--teal);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  font-weight: 800;
}
.stats-masthead h1 {
  margin: 0;
  color: var(--ink);
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}
.stats-masthead__lead {
  max-width: 640px;
  margin: 10px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.7;
}
.stats-masthead__stamp {
  display: grid;
  flex: 0 0 auto;
  gap: 4px;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 10px 24px #0f172a0a;
}
.stats-masthead__stamp span,
.stats-masthead__stamp small {
  color: var(--faint);
  font-size: 11px;
}
.stats-masthead__stamp strong {
  color: var(--teal);
  font-size: 15px;
  font-weight: 800;
}

/* —— 查询面板 —— */
.stats-filter-panel {
  padding: 20px 22px 16px;
  background: #fffffff2;
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: 0 18px 40px #0f172a0d;
}
.stats-filter-panel__head,
.content-heading,
.content-heading--wide {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}
.stats-filter-panel__head {
  margin-bottom: 16px;
}
.stats-filter-panel h2,
.content-heading h2 {
  margin: 3px 0 0;
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
}
.stats-filter-panel__head p,
.content-heading p {
  margin: 5px 0 0;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.5;
}
.stats-filter-panel__hint,
.content-heading__note {
  flex-shrink: 0;
  color: var(--faint);
  font-size: 12px;
}
.section-index {
  display: inline-block;
  color: var(--teal);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.section-index--light {
  color: #14b8a6;
}
.stats-filter-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr)) minmax(130px, 0.8fr);
  gap: 12px;
  align-items: end;
}
.stats-field {
  display: grid;
  gap: 7px;
}
.stats-field > span {
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
}
.stats-field select {
  width: 100%;
  min-width: 0;
  padding: 10px 30px 10px 12px;
  color: var(--ink);
  background-color: #fff;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  outline: none;
  font-size: 13px;
  font-weight: 600;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.stats-field select:focus {
  border-color: var(--teal);
  box-shadow: 0 0 0 3px #0f766e1f;
}
.stats-query-button {
  display: flex;
  min-height: 41px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  color: #fff;
  background: linear-gradient(135deg, #0f766e 0%, #0f9f8e 100%);
  border: 1px solid #0f766e;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 4px 14px #0f766e40;
  transition: transform 0.15s, box-shadow 0.15s;
}
.stats-query-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px #0f766e59;
}
.stats-query-button:active:not(:disabled) {
  transform: translateY(0);
}
.stats-query-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.stats-filter-panel__foot {
  margin: 12px 0 0;
  color: var(--faint);
  font-size: 11px;
}
.stats-error {
  margin: 0;
  padding: 12px 14px;
  color: #b91c1c;
  background: var(--red-soft);
  border: 1px solid #fecaca;
  border-radius: 12px;
  font-size: 13px;
}

/* —— 视图切换 —— */
.stats-workspace {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}
.stats-tabs {
  position: sticky;
  top: 18px;
  display: grid;
  gap: 4px;
  padding: 8px;
  background: #fffffff2;
  border: 1px solid var(--line);
  border-radius: 16px;
  box-shadow: 0 18px 40px #0f172a0d;
}
.stats-tab {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  color: var(--ink-soft);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  transition: color 0.15s, background 0.15s;
}
.stats-tab:hover {
  color: var(--ink);
  background: #f8fafc;
}
.stats-tab--active {
  color: var(--teal);
  background: var(--teal-soft);
  font-weight: 700;
}
.stats-tab__index {
  width: 18px;
  color: var(--faint);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.stats-tab--active .stats-tab__index {
  color: var(--teal);
}
.stats-tab:focus-visible,
.route-link:focus-visible,
.text-action:focus-visible,
.stats-query-button:focus-visible {
  outline: 3px solid #0f766e33;
  outline-offset: 2px;
}
.stats-content {
  display: grid;
  min-width: 0;
  gap: 18px;
}

/* —— 班级成绩脉搏（浅色主视觉）—— */
.score-pulse,
.compare-hero {
  background: linear-gradient(160deg, #ffffff 0%, #f0fdf9 100%);
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: 0 18px 40px #0f172a0d;
}
.score-pulse {
  padding: 25px 27px 0;
}
.score-pulse__topline,
.score-pulse__bottomline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.score-pulse__label,
.compare-hero p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.score-pulse h2,
.compare-hero h2 {
  margin: 4px 0 0;
  color: var(--ink);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.score-pulse__context {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
  color: var(--muted);
  font-size: 11px;
}
.score-pulse__context span {
  padding: 5px 8px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.score-pulse__body {
  display: grid;
  grid-template-columns: minmax(230px, 1fr) minmax(300px, 0.95fr);
  gap: 28px;
  align-items: stretch;
  margin-top: 26px;
  padding: 22px 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.score-pulse__primary {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.score-pulse__primary > span,
.score-pulse__metrics span {
  color: var(--muted);
  font-size: 12px;
}
.score-pulse__primary > strong {
  margin: 7px 0 16px;
  color: var(--ink);
  font-size: clamp(54px, 8vw, 84px);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 0.9;
}
.pulse-meter {
  height: 8px;
  overflow: hidden;
  background: var(--line);
  border-radius: 999px;
}
.pulse-meter span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #0f766e, #14b8a6);
  border-radius: 999px;
}
.pulse-meter__labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--muted);
  font-size: 11px;
}
.pulse-meter__labels strong {
  color: var(--teal);
}
.score-pulse__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-left: 1px solid var(--line);
}
.score-pulse__metrics > div {
  display: grid;
  align-content: center;
  gap: 6px;
  padding: 9px 20px;
  border-bottom: 1px solid var(--line);
}
.score-pulse__metrics > div:nth-child(odd) {
  border-right: 1px solid var(--line);
}
.score-pulse__metrics > div:nth-last-child(-n + 2) {
  border-bottom: 0;
}
.score-pulse__metrics strong {
  color: var(--ink);
  font-size: 23px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.score-pulse__metrics > div:last-child strong {
  color: var(--red);
}
.score-pulse__bottomline {
  align-items: center;
  padding: 13px 0 15px;
  color: var(--muted);
  font-size: 11px;
}
.score-pulse__bottomline strong {
  color: var(--ink-soft);
  font-size: 12px;
}

/* —— 概览 —— */
.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);
  gap: 18px;
}
.insight-panel,
.route-panel,
.subject-snapshot,
.section-block {
  min-width: 0;
  padding: 21px 22px;
  background: #fffffff2;
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: 0 18px 40px #0f172a0d;
}
.insight-list {
  margin-top: 18px;
  border-top: 1px solid var(--line);
}
.insight-item {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: center;
  padding: 13px 0;
  border-bottom: 1px solid var(--line);
}
.insight-item__dot {
  width: 7px;
  height: 7px;
  background: var(--faint);
  border-radius: 50%;
}
.insight-item--positive .insight-item__dot {
  background: var(--teal);
}
.insight-item--watch .insight-item__dot {
  background: #f59e0b;
}
.insight-item div {
  display: grid;
  gap: 3px;
}
.insight-item div span {
  color: var(--muted);
  font-size: 11px;
}
.insight-item div strong {
  color: var(--ink);
  font-size: 14px;
}
.insight-item em {
  color: var(--ink-soft);
  font-size: 12px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.route-panel .content-heading {
  margin-bottom: 9px;
}
.route-link {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 0;
  color: var(--ink);
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--line);
}
.route-link span {
  display: grid;
  gap: 4px;
}
.route-link strong {
  font-size: 13px;
}
.route-link small {
  color: var(--muted);
  font-size: 11px;
}
.route-link b {
  color: var(--teal);
  font-size: 19px;
  font-weight: 500;
  transition: transform 0.15s;
}
.route-link:hover b {
  transform: translateX(4px);
}
.text-action {
  padding: 2px 0;
  color: var(--teal);
  background: transparent;
  border: 0;
  font-size: 12px;
  font-weight: 600;
}
.subject-rail,
.subject-compare-list,
.leaderboard {
  margin-top: 18px;
  border-top: 1px solid var(--line);
}
.subject-rail__row {
  display: grid;
  grid-template-columns: 100px minmax(80px, 1fr) 48px 110px;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.subject-rail__row strong,
.subject-compare-row__name strong {
  color: var(--ink);
  font-size: 13px;
}
.subject-rail__row > span {
  color: var(--teal);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  text-align: right;
}
.subject-rail__row small {
  color: var(--muted);
  font-size: 11px;
  text-align: right;
}
.subject-rail__track,
.subject-compare-row__bar,
.leaderboard-row__bar {
  height: 7px;
  overflow: hidden;
  background: var(--line);
  border-radius: 999px;
}
.subject-rail__track span,
.subject-compare-row__bar span,
.leaderboard-row__bar span {
  display: block;
  height: 100%;
  background: var(--teal);
  border-radius: 999px;
}

/* —— 空态 —— */
.stats-empty {
  display: grid;
  justify-items: center;
  padding: 74px 24px;
  text-align: center;
  background: #fffffff2;
  border: 1px solid var(--line);
  border-radius: 20px;
  box-shadow: 0 18px 40px #0f172a0d;
}
.stats-empty--compact {
  padding: 45px 24px;
}
.stats-empty__mark {
  font-size: 34px;
  line-height: 1;
}
.stats-empty h2 {
  margin: 14px 0 5px;
  color: var(--ink);
  font-size: 19px;
  font-weight: 800;
}
.stats-empty p,
.stats-empty small {
  max-width: 430px;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.7;
}
.stats-empty small {
  margin-top: 8px;
  font-size: 11px;
}
.content-heading--wide {
  align-items: flex-end;
}
.legend {
  display: flex;
  gap: 14px;
  color: var(--muted);
  font-size: 11px;
}
.legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.legend-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.legend-dot--teal {
  background: var(--teal);
}
.legend-dot--coral {
  background: var(--red);
}

/* —— 科目比较 —— */
.subject-compare-row {
  display: grid;
  grid-template-columns: 145px minmax(100px, 1fr) 55px minmax(210px, 0.8fr);
  gap: 14px;
  align-items: center;
  padding: 13px 0;
  border-bottom: 1px solid var(--line);
}
.subject-compare-row__name {
  display: grid;
  gap: 3px;
}
.subject-compare-row__name span,
.subject-compare-row__rates {
  color: var(--muted);
  font-size: 11px;
}
.subject-compare-row__score {
  color: var(--teal);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.subject-compare-row__rates {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  white-space: nowrap;
}
.is-alert {
  color: var(--red);
}

/* —— 表格 —— */
.table-wrap {
  width: 100%;
  overflow-x: auto;
}
.stats-table-wrap {
  margin-top: 18px;
  border-top: 1px solid var(--line);
}
.stats-table {
  min-width: 780px;
  border-collapse: collapse;
  width: 100%;
  color: var(--ink-soft);
  font-size: 12px;
}
.stats-table th {
  padding: 12px 10px;
  color: var(--muted);
  background: #f8fafc;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
  font-weight: 700;
  text-align: left;
  white-space: nowrap;
}
.stats-table td {
  padding: 13px 10px;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.stats-table tbody tr:hover {
  background: #f8fafc;
}
.stats-table td strong {
  color: var(--ink);
  font-size: 13px;
}
.stats-note {
  margin: 12px 0 0;
  color: var(--muted);
  font-size: 11px;
}
.rate-chip,
.pass-rate-good,
.pass-rate-ok,
.pass-rate-low {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.rate-chip--good,
.pass-rate-good {
  color: #065f46;
  background: #d1fae5;
}
.rate-chip--low,
.pass-rate-low {
  color: #b91c1c;
  background: var(--red-soft);
}
.pass-rate-ok {
  color: #92400e;
  background: var(--amber-soft);
}

/* —— 分布图 —— */
.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}
.chart-card {
  min-width: 0;
  padding: 14px 14px 10px;
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 16px;
}
.chart-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--ink);
}
.chart-card__head strong {
  font-size: 13px;
}
.chart-card__head span {
  color: var(--muted);
  font-size: 11px;
}
.chart-svg,
.compare-chart {
  display: block;
  width: 100%;
  height: auto;
}
.chart-svg {
  margin-top: 12px;
}
.chart-bar {
  fill: var(--teal);
}
.chart-bar-label,
.chart-axis-label,
.compare-chart-label,
.compare-chart-value {
  font-family: inherit;
  font-size: 10px;
}
.chart-bar-label,
.compare-chart-value {
  fill: var(--ink-soft);
  font-weight: 700;
}
.chart-axis-label {
  fill: var(--faint);
}
.chart-axis-line {
  stroke: #cbd5e1;
  stroke-width: 1;
}

/* —— 班级对比 —— */
.compare-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding: 24px 26px;
}
.compare-hero__winner {
  display: grid;
  min-width: 180px;
  gap: 4px;
  padding: 12px 18px;
  background: var(--teal-soft);
  border: 1px solid #0f766e26;
  border-radius: 14px;
}
.compare-hero__winner span {
  color: var(--muted);
  font-size: 11px;
}
.compare-hero__winner strong {
  color: var(--ink);
  font-size: 15px;
}
.compare-hero__winner b {
  color: var(--teal);
  font-size: 25px;
  font-variant-numeric: tabular-nums;
}
.compare-chart-bar {
  fill: var(--teal);
}
.compare-chart-label {
  fill: var(--ink-soft);
}
.leaderboard-row {
  display: grid;
  grid-template-columns: 34px minmax(145px, 1.1fr) minmax(100px, 1fr) 55px 63px;
  gap: 14px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.leaderboard-row--first {
  padding-top: 17px;
  background: var(--teal-tint);
  border-bottom-color: #99e3d2;
}
.leaderboard-row__rank {
  color: var(--faint);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}
.leaderboard-row--first .leaderboard-row__rank {
  color: var(--teal);
}
.leaderboard-row__class {
  display: grid;
  gap: 3px;
}
.leaderboard-row__class strong {
  color: var(--ink);
  font-size: 13px;
}
.leaderboard-row__class span {
  color: var(--muted);
  font-size: 11px;
}
.leaderboard-row__score {
  color: var(--ink);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* —— 排名 —— */
.podium {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
  margin: 20px 0;
}
.podium-card {
  display: grid;
  min-height: 112px;
  align-content: end;
  gap: 5px;
  padding: 15px;
  color: var(--ink);
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 16px;
}
.podium-card--1 {
  min-height: 142px;
  background: var(--amber-soft);
  border-color: #f59e0b59;
}
.podium-card--2 {
  background: #f1f5f9;
}
.podium-card--3 {
  background: #fef9ee;
  border-color: #e7c98b;
}
.podium-card__rank {
  color: var(--faint);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}
.podium-card--1 .podium-card__rank {
  color: var(--amber);
}
.podium-card--2 .podium-card__rank {
  color: #64748b;
}
.podium-card--3 .podium-card__rank {
  color: #92400e;
}
.podium-card strong {
  font-size: 15px;
}
.podium-card > span:last-child {
  color: var(--ink-soft);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ranking-table {
  min-width: 620px;
}
.score-cell {
  color: var(--ink);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.rank-badge {
  display: inline-flex;
  min-width: 28px;
  height: 26px;
  align-items: center;
  justify-content: center;
  color: var(--ink-soft);
  background: #f1f5f9;
  border-radius: 8px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.rank-badge--top {
  color: #92400e;
  background: var(--amber-soft);
}
.subject-score-tag {
  display: inline-block;
  margin: 2px 7px 2px 0;
  padding: 3px 8px;
  color: var(--ink-soft);
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 11px;
}
.gap-cell {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.gap-negative {
  color: var(--red);
}
.gap-positive {
  color: var(--teal);
}

/* —— 响应式 —— */
@media (max-width: 1080px) {
  .stats-filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .stats-field--mode {
    grid-column: span 1;
  }
  .stats-query-button {
    min-width: 140px;
  }
  .subject-compare-row {
    grid-template-columns: 130px minmax(80px, 1fr) 50px minmax(190px, 0.8fr);
  }
}
@media (max-width: 900px) {
  .stats-workspace {
    grid-template-columns: 1fr;
  }
  .stats-tabs {
    position: static;
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 6px;
  }
  .stats-tab {
    flex: 0 0 auto;
    min-height: 40px;
    white-space: nowrap;
  }
  .overview-grid,
  .score-pulse__body {
    grid-template-columns: 1fr;
  }
  .score-pulse__metrics {
    border-top: 1px solid var(--line);
    border-left: 0;
  }
  .subject-compare-row {
    grid-template-columns: 130px minmax(80px, 1fr) 50px;
  }
  .subject-compare-row__rates {
    grid-column: 2 / -1;
    justify-content: flex-start;
  }
}
@media (max-width: 650px) {
  .stats-masthead {
    display: grid;
    align-items: start;
  }
  .stats-masthead__stamp {
    width: 100%;
  }
  .stats-filter-panel {
    padding: 17px 15px 14px;
  }
  .stats-filter-panel__head,
  .content-heading--wide,
  .score-pulse__topline,
  .score-pulse__bottomline,
  .compare-hero {
    display: grid;
    align-items: start;
  }
  .stats-filter-grid {
    grid-template-columns: 1fr;
  }
  .stats-query-button {
    width: 100%;
  }
  .score-pulse {
    padding: 20px 17px 0;
  }
  .score-pulse__context {
    justify-content: flex-start;
  }
  .score-pulse__metrics {
    grid-template-columns: 1fr 1fr;
  }
  .score-pulse__metrics > div {
    padding: 9px 12px;
  }
  .score-pulse__bottomline {
    gap: 8px;
  }
  .subject-snapshot,
  .insight-panel,
  .route-panel,
  .section-block {
    padding: 17px 15px;
  }
  .subject-rail__row {
    grid-template-columns: minmax(80px, 1fr) 48px;
    gap: 8px 12px;
  }
  .subject-rail__track {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .subject-rail__row small {
    grid-column: 1 / -1;
    grid-row: 3;
    text-align: left;
  }
  .subject-compare-row {
    grid-template-columns: minmax(80px, 1fr) 48px;
    gap: 8px 12px;
  }
  .subject-compare-row__name {
    grid-column: 1;
  }
  .subject-compare-row__bar {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .subject-compare-row__score {
    grid-column: 2;
    grid-row: 1;
  }
  .subject-compare-row__rates {
    grid-column: 1 / -1;
    grid-row: 3;
    flex-wrap: wrap;
  }
  .chart-grid {
    grid-template-columns: 1fr;
  }
  .leaderboard-row {
    grid-template-columns: 30px minmax(0, 1fr) 52px;
    gap: 8px;
  }
  .leaderboard-row__bar {
    grid-column: 2 / -1;
    grid-row: 2;
  }
  .leaderboard-row .rate-chip {
    grid-column: 2;
    grid-row: 3;
    justify-self: start;
  }
  .podium {
    grid-template-columns: 1fr;
  }
  .podium-card,
  .podium-card--1 {
    min-height: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .class-stats-page *,
  .class-stats-page *::before,
  .class-stats-page *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>

