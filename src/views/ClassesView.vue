<template>
  <section class="page class-roster-page">
    <header class="class-roster-masthead">
      <div class="class-roster-masthead__copy">
        <p class="roster-kicker">学校管理 / 班级</p>
        <h1>班级管理</h1>
        <p class="roster-lead">维护班级基础信息、班主任归属和课程安排。</p>
      </div>
      <div class="class-roster-signpost" aria-label="当前筛选结果">
        <span class="class-roster-signpost__value">{{ total }}</span>
        <span class="class-roster-signpost__label">当前结果</span>
      </div>
      <button v-if="isSuperAdmin" class="button primary class-roster-create" type="button" @click="openCreate">
        <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span>新增班级</span>
      </button>
    </header>

    <div v-if="!isSuperAdmin" class="class-readonly-note">
      <span class="class-readonly-note__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 10.5v5M12 7.5h.01" /></svg>
      </span>
      <div>
        <strong>当前为只读模式</strong>
        <p>当前账号可以查看班级和课程信息，但不能调整班级基础配置。</p>
      </div>
    </div>

    <section class="roster-metrics" aria-label="班级概览">
      <article class="roster-metric">
        <span class="roster-metric__index">01</span>
        <div>
          <span class="roster-metric__label">班级总数</span>
          <strong>{{ total }}</strong>
        </div>
          <span class="roster-metric__note">当前筛选</span>
      </article>
      <article class="roster-metric">
        <span class="roster-metric__index">02</span>
        <div>
          <span class="roster-metric__label">本页启用班级</span>
          <strong>{{ enabledCount }}</strong>
        </div>
        <span class="roster-metric__note">正常教学</span>
      </article>
      <article class="roster-metric">
        <span class="roster-metric__index">03</span>
        <div>
          <span class="roster-metric__label">本页重点班</span>
          <strong>{{ keyClassCount }}</strong>
        </div>
        <span class="roster-metric__note">培优体系</span>
      </article>
      <article class="roster-metric">
        <span class="roster-metric__index">04</span>
        <div>
          <span class="roster-metric__label">本页已分配班主任</span>
          <strong>{{ headTeacherCount }}</strong>
        </div>
        <span class="roster-metric__note">班级归属</span>
      </article>
    </section>

    <section class="roster-index-panel" aria-labelledby="roster-index-title">
      <div class="roster-section-heading">
        <div class="roster-section-heading__title">
          <span class="roster-section-number">01</span>
          <div>
            <p class="roster-kicker">筛选条件</p>
            <h2 id="roster-index-title">筛选班级</h2>
          </div>
        </div>
        <p class="roster-section-heading__hint">按届次、年级和班级逐级缩小范围。</p>
      </div>
      <form class="roster-query-form" @submit.prevent="search(true)">
        <label class="roster-field">
          <span>届次</span>
          <select v-model="query.gradeSession" aria-label="按届次筛选" @change="onFilterSessionChange">
            <option value="">全部届次</option>
            <option v-for="year in realSessions" :key="year" :value="year">{{ year }}届</option>
          </select>
        </label>
        <label class="roster-field">
          <span>年级</span>
          <select v-model="query.gradeLevel" aria-label="按年级筛选" @change="onFilterGradeChange">
            <option value="">全部年级</option>
            <option v-for="item in availableGradeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="roster-field">
          <span>班级</span>
          <select v-model="query.classId" aria-label="按班级筛选">
            <option value="">全部班级</option>
            <option v-for="item in availableClassOptions" :key="item.id ?? item.classId" :value="item.id ?? item.classId">
              {{ classOptionName(item) }}
            </option>
          </select>
        </label>
        <div class="roster-query-actions">
          <button class="button primary" type="submit" :disabled="loading">
            <span>{{ loading ? '查询中…' : '应用筛选' }}</span>
            <span v-if="loading" class="roster-button-spinner" aria-hidden="true"></span>
            <svg v-else class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
          <button class="button ghost" type="button" @click="resetQuery">清除条件</button>
        </div>
      </form>
      <div v-if="hasActiveFilters" class="roster-filter-summary" aria-live="polite">
        <span class="roster-filter-summary__label">已选条件</span>
        <span v-if="query.gradeSession" class="roster-filter-chip">{{ query.gradeSession }}届</span>
        <span v-if="query.gradeLevel" class="roster-filter-chip">{{ gradeLabel(query.gradeLevel) }}</span>
        <span v-if="query.classId" class="roster-filter-chip">{{ selectedClassLabel || '已选班级' }}</span>
      </div>
    </section>

    <section class="roster-results" aria-labelledby="roster-results-title" :aria-busy="loading">
      <div class="roster-results-heading">
        <div>
          <p class="roster-kicker">班级列表</p>
          <h2 id="roster-results-title">班级名册</h2>
        </div>
        <p class="roster-results-heading__count">{{ total }} <span>间教室</span></p>
      </div>

      <div v-if="loading" class="roster-grid roster-grid--loading" aria-label="正在加载班级">
        <article v-for="item in 6" :key="item" class="roster-card roster-card--skeleton">
          <span class="skeleton-line skeleton-name"></span>
          <span class="skeleton-line skeleton-meta"></span>
          <span class="skeleton-line skeleton-meta"></span>
          <span class="skeleton-line skeleton-action"></span>
        </article>
      </div>

      <div v-else-if="listError" class="roster-error" role="alert">
        <div class="roster-error__mark" aria-hidden="true">!</div>
        <div>
          <h3>班级列表加载失败</h3>
          <p>{{ listError }}</p>
        </div>
        <button class="button ghost" type="button" @click="search(false)">重新加载</button>
      </div>

      <div v-else-if="!classes.length" class="roster-empty">
        <span class="roster-empty__index">00</span>
        <div>
          <h3>这组条件下还没有班级</h3>
          <p>切换届次、年级或班级，重新查看名册<span v-if="isSuperAdmin">；也可以新增一个班级。</span></p>
        </div>
        <button v-if="isSuperAdmin" class="button ghost" type="button" @click="openCreate">新增班级 <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </div>

      <div v-else class="roster-grid">
        <article
          v-for="item in classes"
          :key="item.id"
          v-memo="[item.id, item.className, item.name, item.classNo, item.classCode, item.gradeSession, item.gradeLevel, item.status, item.isKeyClass, item.headTeacherUserId, item.headTeacherName, item.courseCombination]"
          class="roster-card"
          :class="{ 'roster-card--inactive': Number(item.status) !== 1 }"
        >
          <div class="roster-card__head">
            <span class="roster-card__number">{{ String(item.classNo || item.id || '').padStart(2, '0') }}</span>
            <div class="roster-card__identity">
              <div class="roster-card__title-row">
                <h3>{{ classNameOf(item) }}</h3>
                <span
                  class="roster-card__badge"
                  :class="Number(item.isKeyClass) === 1 ? 'roster-card__badge--key' : 'roster-card__badge--normal'"
                >
                  {{ Number(item.isKeyClass) === 1 ? '重点班' : '普通班' }}
                </span>
              </div>
              <p v-if="item.classCode || combinationLabel(item)" class="roster-card__code">
                <span v-if="item.classCode">{{ item.classCode }}</span>
                <span v-if="combinationLabel(item)" :class="['roster-card__combo', { 'roster-card__combo--first': !item.classCode }]">{{ combinationLabel(item) }}</span>
              </p>
            </div>
            <span
              :class="['roster-card__status-dot', Number(item.status) === 1 ? 'roster-card__status-dot--active' : 'roster-card__status-dot--inactive']"
              :title="Number(item.status) === 1 ? '启用' : '停用'"
              aria-hidden="true"
            ></span>
          </div>

          <div class="roster-card__details">
            <dl class="roster-card__facts">
              <div>
                <dt>届次</dt>
                <dd>{{ item.gradeSession ? `${item.gradeSession}届` : '-' }}</dd>
              </div>
              <div>
                <dt>年级</dt>
                <dd>{{ gradeLabel(item.gradeLevel) }}</dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>{{ Number(item.status) === 1 ? '启用' : '停用' }}</dd>
              </div>
            </dl>
            <div class="roster-card__teacher">
              <span class="roster-card__teacher-avatar" aria-hidden="true">{{ String(item.headTeacherName || '师').slice(0, 1) }}</span>
              <div>
                <span class="roster-card__teacher-label">班主任</span>
                <strong>{{ item.headTeacherName || '未分配' }}</strong>
              </div>
            </div>
          </div>

          <div class="roster-card__actions">
            <button class="button primary sm" type="button" @click="openCourseManage(item)">编排课程 <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
            <template v-if="isSuperAdmin">
              <button class="button ghost sm" type="button" @click="openEdit(item)">编辑</button>
              <button class="button ghost danger sm" type="button" @click="removeClass(item)">删除</button>
            </template>
          </div>
        </article>
      </div>
    </section>

    <div v-if="!loading && total > 0" class="roster-pagination">
      <div class="roster-pagination__summary">
        <span>共 {{ total }} 条</span>
        <span class="roster-pagination__divider">/</span>
        <span>第 {{ page.current }} / {{ totalPages }} 页</span>
        <label>
          每页
          <select v-model.number="page.size" class="pagination-size-select" aria-label="每页条数">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          条
        </label>
      </div>
      <div v-if="totalPages > 1" class="roster-pagination__buttons">
        <button class="button ghost sm" type="button" :disabled="page.current <= 1" @click="goPage(page.current - 1)"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>上一页</button>
        <button
          v-for="num in pageNumbers"
          :key="num"
          :class="['button', 'sm', num === page.current ? 'primary' : 'ghost']"
          type="button"
          :aria-label="`第 ${num} 页`"
          :aria-current="num === page.current ? 'page' : undefined"
          @click="goPage(num)"
        >
          {{ num }}
        </button>
        <button class="button ghost sm" type="button" :disabled="page.current >= totalPages" @click="goPage(page.current + 1)">下一页<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
      </div>
    </div>

    <!-- Create/Edit Class Modal -->
    <Teleport to="body">
      <div v-if="modalVisible" class="modal-backdrop" @click.self="closeModal">
        <section class="modal-card class-editor-modal" role="dialog" aria-modal="true" :aria-labelledby="editing ? 'edit-class-title' : 'create-class-title'">
          <div class="class-modal-head">
            <div>
              <p class="roster-kicker">{{ editing ? '编辑班级' : '新增班级' }}</p>
              <h2 :id="editing ? 'edit-class-title' : 'create-class-title'">{{ editing ? '修改班级信息' : '录入班级信息' }}</h2>
            </div>
            <button class="button ghost sm modal-close" type="button" aria-label="关闭弹窗" @click="closeModal"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          <form class="class-editor-form" @submit.prevent="submitClass">
            <p v-if="modalError" class="error class-editor-form__error">{{ modalError }}</p>

            <div class="class-editor-grid">
              <label class="roster-field">
                <span>班级编号</span>
                <select v-model="form.classNo" required>
                  <option value="">请选择班级编号</option>
                  <option v-for="num in classNumbers" :key="num" :value="num">{{ num }}班</option>
                </select>
              </label>
              <label class="roster-field">
                <span>届次</span>
                <select v-model="form.gradeSession" required>
                  <option value="">请选择届次</option>
                  <option v-for="year in formSessions" :key="year" :value="year">{{ year }}届</option>
                </select>
              </label>
              <label class="roster-field">
                <span>年级</span>
                <select v-model.number="form.gradeLevel" required>
                  <option value="">请选择年级</option>
                  <option v-for="item in gradeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </label>
              <label class="roster-field">
                <span>班主任</span>
                <select v-model="form.headTeacherUserId" required>
                  <option value="">班主任（必选）</option>
                  <option v-for="teacher in teachers" :key="teacher.id" :value="teacher.id">{{ teacher.realName || teacher.name }}</option>
                </select>
              </label>
              <label class="roster-field">
                <span>班级类型</span>
                <select v-model.number="form.isKeyClass">
                  <option :value="0">普通班</option>
                  <option :value="1">重点班</option>
                </select>
              </label>
              <label class="roster-field">
                <span>状态</span>
                <select v-model.number="form.status">
                  <option :value="1">启用</option>
                  <option :value="0">停用</option>
                </select>
              </label>
            </div>

            <div class="course-combo-section">
              <div class="course-combo-section__head">
                <div>
                  <p class="roster-kicker">选课组合</p>
                  <h3>选课配置</h3>
                </div>
                <span class="course-combo-section__count">三步完成</span>
              </div>

              <div class="course-combo-step">
                <div class="course-combo-step__heading"><span>A</span><strong>外语</strong></div>
                <div class="course-combo-options">
                  <label v-for="opt in foreignLangOptions" :key="opt.code" class="course-combo-chip" :class="{ 'course-combo-chip--active': form.foreignLanguage === opt.code }">
                    <input type="radio" :value="opt.code" v-model="form.foreignLanguage" />
                    <span>{{ opt.name }}</span>
                  </label>
                </div>
              </div>

              <div class="course-combo-step">
                <div class="course-combo-step__heading"><span>B</span><strong>物理 / 历史</strong></div>
                <div class="course-combo-options">
                  <label v-for="opt in phOrHiOptions" :key="opt.code" class="course-combo-chip" :class="{ 'course-combo-chip--active': form.phOrHi === opt.code }">
                    <input type="radio" :value="opt.code" v-model="form.phOrHi" />
                    <span>{{ opt.name }}</span>
                  </label>
                </div>
              </div>

              <div class="course-combo-step">
                <div class="course-combo-step__heading"><span>C</span><strong>选修课程（4选2）</strong><small>已选 {{ form.electiveTwo.length }}/2</small></div>
                <div class="course-combo-options">
                  <label
                    v-for="opt in electiveOptions"
                    :key="opt.code"
                    class="course-combo-chip"
                    :class="{
                      'course-combo-chip--active': form.electiveTwo.includes(opt.code),
                      'course-combo-chip--disabled': form.electiveTwo.length >= 2 && !form.electiveTwo.includes(opt.code)
                    }"
                  >
                    <input
                      type="checkbox"
                      :value="opt.code"
                      :checked="form.electiveTwo.includes(opt.code)"
                      :disabled="form.electiveTwo.length >= 2 && !form.electiveTwo.includes(opt.code)"
                      @change="toggleElective(opt.code)"
                    />
                    <span>{{ opt.name }}</span>
                  </label>
                </div>
              </div>

              <div v-if="classNamePreview" class="course-combo-preview">
                <span>名称预览</span><strong>{{ classNamePreview }}</strong>
              </div>
            </div>

            <div class="modal-actions class-editor-form__actions">
              <button class="button ghost" type="button" @click="closeModal">取消</button>
              <button class="button primary" type="submit" :disabled="savingClass">
                <span>{{ savingClass ? '保存中…' : '保存班级' }}</span>
                <span v-if="savingClass" class="roster-button-spinner" aria-hidden="true"></span>
                <svg v-else class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </form>
        </section>
      </div>
    </Teleport>

    <!-- Course Management Modal -->
    <Teleport to="body">
      <div v-if="courseModalVisible" class="modal-backdrop" @click.self="closeCourseModal">
        <section class="modal-card course-workbench" role="dialog" aria-modal="true" aria-labelledby="course-manage-title">
          <div class="course-modal-head">
            <div>
              <p class="roster-kicker">课程编排</p>
              <h2 id="course-manage-title">{{ courseClassName }}</h2>
              <p>维护当前班级的学期课程和任课教师。</p>
            </div>
            <button class="button ghost sm modal-close" type="button" aria-label="关闭弹窗" @click="closeCourseModal"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>

          <div v-if="courseLoading" class="course-loading">正在同步课程名册…</div>
          <template v-else>
            <label class="roster-field course-term-field">
              <span>当前学期</span>
              <select v-model="selectedTermId" @change="loadClassSubjects">
                <option value="">请选择学期</option>
                <option v-for="term in academicTerms" :key="term.id" :value="term.id">{{ term.termName || term.termCode }}</option>
              </select>
            </label>

            <template v-if="selectedTermId">
              <div v-if="courseClassCombination" class="course-combo-info-bar">
                <span class="course-context-label">班级组合</span>
                <strong>{{ combinationLabel({ courseCombination: courseClassCombination }) }}</strong>
              </div>
              <div v-if="gradeSubjectsNotConfigured" class="course-combo-mismatch">
                年级课程尚未配置，请先在系统配置中的年级课程配置完成设置。
              </div>

              <div class="course-list" v-if="classSubjects.length">
                <div v-for="(cs, index) in classSubjects" :key="cs.id" class="course-item-row">
                  <span class="course-item-index">{{ String(index + 1).padStart(2, '0') }}</span>
                  <div class="course-item-info">
                    <strong>{{ cs.subjectName }}</strong>
                    <span :class="cs.teacherName ? '' : 'muted-block'">{{ cs.teacherName || '未分配教师' }}</span>
                  </div>
                  <div class="course-item-actions">
                    <button class="button ghost sm" type="button" @click="openAssignTeacher(cs)">设教师</button>
                    <button class="button ghost danger sm" type="button" @click="removeClassSubject(cs)">删除</button>
                  </div>
                </div>
              </div>
              <div v-else class="course-list-empty">当前学期暂无课程安排。</div>

              <div class="course-add-panel">
                <div class="course-add-panel__heading">
                  <span class="roster-kicker">添加课程</span>
                  <strong>添加课程</strong>
                </div>
                <div class="course-add-row">
                  <select v-model="newSubjectId" class="course-add-select" aria-label="选择科目">
                    <option value="">选择科目</option>
                    <option v-for="sub in availableSubjects" :key="sub.id" :value="sub.id">{{ sub.subjectName || sub.name }}</option>
                  </select>
                  <div class="teacher-search teacher-search--inline">
                    <input
                      v-model="addTeacherKeyword"
                      class="roster-input"
                      autocomplete="off"
                      placeholder="可选：搜索任课老师"
                      @input="onAddTeacherInput()"
                      @focus="doSearchAddTeachers()"
                    />
                    <div v-if="addTeacherSearchLoading" class="teacher-search-loading">搜索中...</div>
                    <div v-if="newTeacherId" class="teacher-search-selected teacher-search-selected--inline">
                      <span class="teacher-search-selected-name">{{ addTeacherKeyword || '已选择' }}</span>
                    <button class="teacher-search-clear" type="button" title="清除选择" @click="clearAddTeacherSelection"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
                    </div>
                    <ul v-if="addTeacherSearchRows.length > 0" class="teacher-search-list">
                      <li v-for="teacher in addTeacherSearchRows" :key="teacher.id" class="teacher-search-item" @mousedown.prevent="selectAddTeacher(teacher)">
                        <strong>{{ teacher.realName || teacher.name }}</strong>
                        <span>{{ teacher.loginName }}</span>
                      </li>
                    </ul>
                    <ul v-else-if="addTeacherKeyword.trim() && !addTeacherSearchLoading && !newTeacherId" class="teacher-search-list">
                      <li class="teacher-search-empty">未找到匹配的老师</li>
                    </ul>
                  </div>
                  <button class="button primary sm course-add-button" type="button" @click="addClassSubject">添加</button>
                </div>
                <p v-if="!availableSubjects.length" class="course-add-hint">没有可添加的科目</p>
              </div>
            </template>
            <p v-else class="course-select-term-hint">请先选择学期，查看该班级的课程安排。</p>
          </template>
        </section>
      </div>
    </Teleport>

    <!-- Assign Teacher Modal -->
    <Teleport to="body">
      <div v-if="assignModalVisible" class="modal-backdrop" @click.self="closeAssignModal">
        <section class="modal-card assign-teacher-modal" role="dialog" aria-modal="true" aria-labelledby="assign-teacher-title">
          <div class="class-modal-head">
            <div>
              <p class="roster-kicker">任课教师</p>
              <h2 id="assign-teacher-title">{{ assignSubjectName }}</h2>
              <p>为这门课指定一位任课老师。</p>
            </div>
            <button class="button ghost sm modal-close" type="button" aria-label="关闭弹窗" @click="closeAssignModal"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          <div class="assign-teacher-body">
            <div class="teacher-search">
              <input
                v-model="assignTeacherKeyword"
                class="roster-input"
                autocomplete="off"
                placeholder="搜索教师姓名..."
                @input="onAssignTeacherInput()"
                @focus="doSearchAssignTeachers()"
              />
              <div v-if="assignTeacherSearchLoading" class="teacher-search-loading">搜索中...</div>
              <div v-if="assignTeacherId" class="teacher-search-selected">
                <span class="teacher-search-selected-name">{{ assignTeacherKeyword || '已选择教师' }}</span>
                <small>ID: {{ assignTeacherId }}</small>
                <button class="teacher-search-clear" type="button" title="清除选择" @click="clearAssignTeacherSelection"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
              </div>
              <ul v-if="assignTeacherSearchRows.length > 0" class="teacher-search-list">
                <li v-for="teacher in assignTeacherSearchRows" :key="teacher.id" class="teacher-search-item" @mousedown.prevent="selectAssignTeacher(teacher)">
                  <strong>{{ teacher.realName || teacher.name }}</strong>
                  <span>{{ teacher.loginName }}</span>
                </li>
              </ul>
              <ul v-else-if="assignTeacherKeyword.trim() && !assignTeacherSearchLoading && !assignTeacherId" class="teacher-search-list">
                <li class="teacher-search-empty">未找到匹配的老师</li>
              </ul>
            </div>
          </div>
          <div class="modal-actions">
            <button class="button ghost" type="button" @click="closeAssignModal">取消</button>
            <button class="button primary" type="button" @click="saveAssignTeacher">保存分配 <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- Error Modal -->
    <Teleport to="body">
      <div v-if="errorModalVisible" class="modal-backdrop" @click.self="errorModalVisible = false">
        <section class="modal-card error-modal" role="dialog" aria-modal="true" aria-labelledby="error-modal-title">
          <div class="class-modal-head">
            <div>
              <p class="roster-kicker">操作提示</p>
              <h2 id="error-modal-title">操作提示</h2>
            </div>
            <button class="button ghost sm modal-close" type="button" aria-label="关闭弹窗" @click="errorModalVisible = false"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
          </div>
          <p class="error error-modal__message">{{ errorModalMessage }}</p>
          <div class="modal-actions">
            <button class="button primary" type="button" @click="errorModalVisible = false">确定</button>
          </div>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import * as schoolApi from '../api/school'
import { useAuthStore } from '../stores/auth'

type AnyRow = Record<string, any>

const auth = useAuthStore()

const isSuperAdmin = computed(() => auth.isSuperAdmin)

// --- Class list state ---
const classes = ref<AnyRow[]>([])
const teachers = ref<AnyRow[]>([])
const total = ref(0)
const explicitTotalPages = ref(0)
const loading = ref(false)
const listError = ref('')
const modalVisible = ref(false)
const editing = ref<AnyRow | null>(null)
const modalError = ref('')
const savingClass = ref(false)
const query = reactive({ gradeSession: '', gradeLevel: '', classId: '' })
const page = reactive({ current: 1, size: 10 })
const form = reactive({
  id: '' as string | number,
  classNo: '' as number | string,
  gradeSession: '' as number | string,
  gradeLevel: '' as number | string,
  headTeacherUserId: '' as number | string,
  isKeyClass: 0,
  status: 1,
  foreignLanguage: 'EN' as string,
  phOrHi: 'PH' as string,
  electiveTwo: [] as string[]
})

// Course combination option constants
const foreignLangOptions = [
  { code: 'EN', name: '英语', short: '英' },
  { code: 'JA', name: '日语', short: '日' }
]
const phOrHiOptions = [
  { code: 'PH', name: '物理', short: '物' },
  { code: 'HI', name: '历史', short: '史' }
]
const electiveOptions = [
  { code: 'CH', name: '化学', short: '化' },
  { code: 'BI', name: '生物', short: '生' },
  { code: 'GE', name: '地理', short: '地' },
  { code: 'PO', name: '政治', short: '政' }
]

// Computed: class name preview with combination
const classNamePreview = computed(() => {
  if (!form.classNo || !form.gradeLevel) return ''
  const grade = gradeLabel(form.gradeLevel)
  const fl = foreignLangOptions.find(o => o.code === form.foreignLanguage)
  const ph = phOrHiOptions.find(o => o.code === form.phOrHi)
  const el1 = electiveOptions.find(o => o.code === form.electiveTwo[0])
  const el2 = electiveOptions.find(o => o.code === form.electiveTwo[1])
  const comboParts = [fl?.short, ph?.short, el1?.short, el2?.short].filter(Boolean)
  return `${grade}(${form.classNo})班-${comboParts.join('-')}`
})

function toggleElective(code: string) {
  const idx = form.electiveTwo.indexOf(code)
  if (idx >= 0) {
    form.electiveTwo.splice(idx, 1)
  } else if (form.electiveTwo.length < 2) {
    form.electiveTwo.push(code)
    form.electiveTwo.sort()
  }
}

function combinationLabel(item: AnyRow) {
  if (!item.courseCombination) return ''
  const parts = (item.courseCombination as string).split('-')
  if (parts.length < 4) return item.courseCombination
  const fl = foreignLangOptions.find(o => o.code === parts[0])
  const ph = phOrHiOptions.find(o => o.code === parts[1])
  const e1 = electiveOptions.find(o => o.code === parts[2])
  const e2 = electiveOptions.find(o => o.code === parts[3])
  return [fl?.short, ph?.short, e1?.short, e2?.short].filter(Boolean).join('-')
}

const currentYear = new Date().getFullYear()
const filterOptions = ref<AnyRow>({})
// 筛选区届次：来自 /classes/filter-options 真实数据（仅已有班级的届次）
const realSessions = computed(() => (filterOptions.value.gradeSessions || []).map((item: any) => String(item)))
const availableGradeOptions = computed(() => {
  const session = String(query.gradeSession || '')
  const combinations = Array.isArray(filterOptions.value.combinations) ? filterOptions.value.combinations : []
  if (!session) return gradeOptions
  const levels = new Set(
    combinations
      .filter((item: AnyRow) => String(item.gradeSession ?? '') === session)
      .map((item: AnyRow) => Number(item.gradeLevel))
  )
  return gradeOptions.filter((item) => levels.has(Number(item.value)))
})
const availableClassOptions = computed(() => {
  const source = Array.isArray(filterOptions.value.classes) ? filterOptions.value.classes : []
  const session = String(query.gradeSession || '')
  const level = query.gradeLevel ? Number(query.gradeLevel) : 0
  return source
    .filter((item: AnyRow) => !session || String(item.gradeSession ?? '') === session)
    .filter((item: AnyRow) => !level || Number(item.gradeLevel) === level)
})
const hasActiveFilters = computed(() => Boolean(query.gradeSession || query.gradeLevel || query.classId))
const selectedClassLabel = computed(() => {
  const selected = availableClassOptions.value.find((item: AnyRow) => String(item.id ?? item.classId) === String(query.classId))
  return selected ? classOptionName(selected) : ''
})
// 表单届次：真实届次 ∪ 今年~+2，保证新学年尚无班级时仍可创建今年新班
const formSessions = computed(() => {
  const set = new Set<string>(realSessions.value)
  for (let year = currentYear; year <= currentYear + 2; year++) set.add(String(year))
  return Array.from(set).sort((a, b) => Number(b) - Number(a))
})
const classNumbers = Array.from({ length: 20 }, (_, index) => index + 1)
const gradeOptions = [
  { value: 1, label: '小学一年级' },
  { value: 2, label: '小学二年级' },
  { value: 3, label: '小学三年级' },
  { value: 4, label: '小学四年级' },
  { value: 5, label: '小学五年级' },
  { value: 6, label: '小学六年级' },
  { value: 7, label: '初中一年级' },
  { value: 8, label: '初中二年级' },
  { value: 9, label: '初中三年级' },
  { value: 10, label: '高中一年级' },
  { value: 11, label: '高中二年级' },
  { value: 12, label: '高中三年级' }
]

const defaultSession = currentYear

// --- Course management state ---
const courseModalVisible = ref(false)
const courseClassName = ref('')
const courseClassId = ref<string | number>('')
const courseClassGradeLevel = ref<number>(0)
const courseClassCombination = ref('')
const courseClassForeignLang = ref('')
const courseClassPhOrHi = ref('')
const courseClassElectiveTwo = ref('')
const courseLoading = ref(false)
const academicTerms = ref<AnyRow[]>([])
const classSubjects = ref<AnyRow[]>([])
const gradeSubjects = ref<AnyRow[]>([])
const allTeachers = ref<AnyRow[]>([])
const selectedTermId = ref<string | number>('')
const newSubjectId = ref('')
const newTeacherId = ref('')

// --- Assign teacher state ---
const assignModalVisible = ref(false)
const assignClassSubjectId = ref<string | number>('')
const assignSubjectName = ref('')
const assignTeacherId = ref('')

// Teacher search state for "设教师" modal
const assignTeacherKeyword = ref('')
const assignTeacherSearchRows = ref<AnyRow[]>([])
const assignTeacherSearchLoading = ref(false)
let assignTeacherSearchTimer: ReturnType<typeof setTimeout> | null = null

// Teacher search state for "添加课程" inline form
const addTeacherKeyword = ref('')
const addTeacherSearchRows = ref<AnyRow[]>([])
const addTeacherSearchLoading = ref(false)
let addTeacherSearchTimer: ReturnType<typeof setTimeout> | null = null
let assignTeacherSearchRequestId = 0
let addTeacherSearchRequestId = 0

// --- Error modal ---
const errorModalVisible = ref(false)
const errorModalMessage = ref('')

// --- Computed ---
const totalPages = computed(() => Math.max(1, explicitTotalPages.value || Math.ceil(total.value / page.size)))
const pageNumbers = computed(() => {
  const start = Math.max(1, page.current - 2)
  const end = Math.min(totalPages.value, page.current + 2)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})
const enabledCount = computed(() => classes.value.filter((item) => Number(item.status) === 1).length)
const keyClassCount = computed(() => classes.value.filter((item) => Number(item.isKeyClass) === 1).length)
const headTeacherCount = computed(() => new Set(classes.value.map((item) => item.headTeacherUserId || item.headTeacherName).filter(Boolean)).size)

// Available subjects not yet assigned to the class
const assignedSubjectIds = computed(() =>
  new Set(classSubjects.value.map((cs) => Number(cs.subjectId)))
)

// 课程候选项只来自当前学期和当前年级的启用课程配置。
const subjectSource = computed((): any[] => {
  return gradeSubjects.value.map((s: any) => ({
    ...s,
    id: Number(s.subjectId || s.id),
  }))
})

// 当前年级没有启用课程配置时提示管理员先完成配置。
const gradeSubjectsNotConfigured = computed(() => gradeSubjects.value.length === 0)

const availableSubjects = computed(() => {
  return subjectSource.value.filter((sub) => !assignedSubjectIds.value.has(Number(sub.id)))
})

// --- Helpers ---
const payload = (res: any) => res?.data?.data ?? res?.data ?? res ?? {}
const rows = (value: any): AnyRow[] => {
  const data = payload(value)
  if (Array.isArray(data)) return data
  return data.items || data.records || data.list || data.content || []
}
const totalOf = (value: any) => Number(payload(value).total ?? rows(value).length ?? 0)
const totalPagesOf = (value: any) => Number(payload(value).totalPages ?? 0)
const call = async (name: string, ...params: any[]) => {
  const fn = (schoolApi as AnyRow)[name]
  return fn ? fn(...params) : []
}

function gradeLabel(value: any) {
  return gradeOptions.find((item) => Number(item.value) === Number(value))?.label || '-'
}

function extractClassNo(className: string) {
  const match = className?.match(/\((\d+)(?:班)?\)\s*班?$/)
  return match ? match[1] : ''
}

function classNameOf(item: AnyRow) {
  if (item.className || item.name) return item.className || item.name
  const grade = gradeLabel(item.gradeLevel)
  const no = item.classNo ? String(item.classNo) : ''
  return no ? `${grade}(${no})班` : grade
}

function classOptionName(item: AnyRow) {
  if (item.className || item.name) return item.className || item.name
  return item.classCode || `班级 ${item.id ?? item.classId}`
}

function onFilterSessionChange() {
  if (query.gradeLevel && !availableGradeOptions.value.some((item) => Number(item.value) === Number(query.gradeLevel))) {
    query.gradeLevel = ''
  }
  query.classId = ''
}

function onFilterGradeChange() {
  query.classId = ''
}

// --- Class list ---
async function loadTeachers() {
  if (isSuperAdmin.value) {
    try {
      const res = await call('listUsers', { roleCode: 'HEAD_TEACHER', page: 1, size: 200 })
      teachers.value = rows(res)
    } catch {
      teachers.value = []
    }
  } else {
    teachers.value = []
  }
}

async function search(resetPage = false) {
  if (resetPage) page.current = 1
  loading.value = true
  listError.value = ''
  try {
    const res = await call('listClasses', {
      page: page.current,
      size: page.size,
      gradeSession: query.gradeSession || undefined,
      gradeLevel: query.gradeLevel || undefined,
      classId: query.classId ? Number(query.classId) : undefined
    })
    classes.value = rows(res)
    total.value = totalOf(res)
    explicitTotalPages.value = totalPagesOf(res)
  } catch (e: any) {
    classes.value = []
    total.value = 0
    explicitTotalPages.value = 0
    listError.value = e?.message || '暂时无法加载班级列表，请检查网络后重试。'
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.gradeSession = ''
  query.gradeLevel = ''
  query.classId = ''
  search(true)
}

function goPage(num: number) { page.current = num; search(false) }
watch(() => page.size, () => { page.current = 1; search(false) })

// --- Create/Edit modal ---
function resetForm() {
  form.id = ''
  form.classNo = ''
  form.gradeSession = defaultSession
  form.gradeLevel = '' as any
  form.headTeacherUserId = ''
  form.isKeyClass = 0
  form.status = 1
  form.foreignLanguage = 'EN'
  form.phOrHi = 'PH'
  form.electiveTwo = []
  modalError.value = ''
}

async function openCreate() {
  editing.value = null
  resetForm()
  await loadTeachers()
  modalVisible.value = true
}

async function openEdit(item: AnyRow) {
  editing.value = item
  resetForm()
  await loadTeachers()
  form.id = item.id
  form.classNo = extractClassNo(item.className || '') || item.classNo || ''
  form.gradeSession = item.gradeSession || defaultSession
  form.gradeLevel = item.gradeLevel || ''
  form.headTeacherUserId = item.headTeacherUserId || ''
  form.isKeyClass = Number(item.isKeyClass || 0)
  form.status = Number(item.status ?? 1)
  form.foreignLanguage = (item.foreignLanguage as string) || 'EN'
  form.phOrHi = (item.phOrHi as string) || 'PH'
  form.electiveTwo = item.electiveTwo ? (item.electiveTwo as string).split(',').filter(Boolean) : []
  modalVisible.value = true
}

function closeModal() { modalVisible.value = false }

function validateForm() {
  if (!form.classNo) return '请选择班级编号'
  if (!form.gradeSession) return '请选择届次'
  if (!form.gradeLevel) return '请选择年级'
  if (!form.headTeacherUserId) return '请选择班主任'
  return ''
}

async function submitClass() {
  if (savingClass.value) return
  modalError.value = validateForm()
  if (modalError.value) return
  if (form.electiveTwo.length !== 2) {
    modalError.value = '请选择 2 门选修科目（当前已选 ' + form.electiveTwo.length + ' 门）'
    return
  }
  savingClass.value = true
  const body: AnyRow = {
    classNo: form.classNo,
    gradeSession: form.gradeSession,
    gradeLevel: Number(form.gradeLevel),
    headTeacherUserId: Number(form.headTeacherUserId),
    isKeyClass: form.isKeyClass,
    status: form.status,
    foreignLanguage: form.foreignLanguage,
    phOrHi: form.phOrHi,
    electiveTwo: [...form.electiveTwo].sort().join(',')
  }
  try {
    if (editing.value) await call('updateClass', form.id, body)
    else await call('createClass', body)
    modalVisible.value = false
    await search(false)
  } catch (e: any) {
    modalError.value = e?.message || (editing.value ? '保存班级失败' : '创建班级失败')
  } finally {
    savingClass.value = false
  }
}

async function removeClass(item: AnyRow) {
  if (!window.confirm(`确定删除${classNameOf(item)}吗？`)) return
  try {
    await call('deleteClass', item.id)
    await search(false)
  } catch (e: any) {
    errorModalMessage.value = e?.message || '删除班级失败'
    errorModalVisible.value = true
  }
}

// --- Course management ---
async function loadAcademicTerms() {
  try {
    academicTerms.value = rows(await call('listAcademicTerms'))
  } catch {
    academicTerms.value = []
  }
}

async function loadGradeSubjects(gradeLevel: number) {
  if (!selectedTermId.value || !gradeLevel) {
    gradeSubjects.value = []
    return
  }
  try {
    gradeSubjects.value = rows(await call('listGradeSubjects', selectedTermId.value, gradeLevel))
      .filter((subject: AnyRow) => Number(subject.status) === 1)
  } catch {
    gradeSubjects.value = []
  }
}

async function loadClassSubjects() {
  if (!selectedTermId.value || !courseClassId.value) { classSubjects.value = []; return }
  courseLoading.value = true
  try {
    const res = await call('listClassSubjects', selectedTermId.value, courseClassId.value)
    classSubjects.value = rows(res)
    await loadGradeSubjects(courseClassGradeLevel.value)
  } catch (e: any) {
    showError(e?.message || '加载课程信息失败')
  } finally {
    courseLoading.value = false
  }
}

async function loadAllTeachers() {
  try {
    const res = await call('searchTeachers', '')
    allTeachers.value = rows(res)
  } catch {
    allTeachers.value = []
  }
}

async function openCourseManage(item: AnyRow) {
  courseClassId.value = item.id
  courseClassName.value = classNameOf(item)
  courseClassGradeLevel.value = Number(item.gradeLevel || 0)
  courseClassCombination.value = (item.courseCombination as string) || ''
  courseClassForeignLang.value = (item.foreignLanguage as string) || ''
  courseClassPhOrHi.value = (item.phOrHi as string) || ''
  courseClassElectiveTwo.value = (item.electiveTwo as string) || ''
  newSubjectId.value = ''
  resetAddTeacherState()
  classSubjects.value = []
  gradeSubjects.value = []
  selectedTermId.value = ''
  courseLoading.value = false

  await Promise.all([loadAcademicTerms(), loadAllTeachers()])
  courseModalVisible.value = true

  // Auto-select first term
  if (academicTerms.value.length > 0) {
    const active = academicTerms.value.find((t: AnyRow) => Number(t.status) === 1) || academicTerms.value[0]
    selectedTermId.value = active.id
    await loadClassSubjects()
  }
}

function closeCourseModal() {
  courseModalVisible.value = false
  newSubjectId.value = ''
  resetAddTeacherState()
}

async function addClassSubject() {
  if (!newSubjectId.value) {
    showError('请选择科目')
    return
  }
  try {
    await call('createClassSubject', {
      academicTermId: Number(selectedTermId.value),
      classId: Number(courseClassId.value),
      subjectId: Number(newSubjectId.value),
      teacherUserId: newTeacherId.value ? Number(newTeacherId.value) : undefined
    })
    newSubjectId.value = ''
    resetAddTeacherState()
    await loadClassSubjects()
  } catch (e: any) {
    showError(e?.message || '添加课程失败')
  }
}

async function removeClassSubject(cs: AnyRow) {
  if (!confirm(`确定要删除"${cs.subjectName}"课程吗？`)) return
  try {
    await call('deleteClassSubject', cs.id)
    await loadClassSubjects()
  } catch (e: any) {
    showError(e?.message || '删除课程失败')
  }
}

function showError(msg: string) {
  errorModalMessage.value = msg
  errorModalVisible.value = true
}

// --- Teacher search helpers ---
function cancelAssignTeacherSearch() {
  assignTeacherSearchRequestId += 1
  if (assignTeacherSearchTimer) {
    clearTimeout(assignTeacherSearchTimer)
    assignTeacherSearchTimer = null
  }
  assignTeacherSearchLoading.value = false
  assignTeacherSearchRows.value = []
}

function cancelAddTeacherSearch() {
  addTeacherSearchRequestId += 1
  if (addTeacherSearchTimer) {
    clearTimeout(addTeacherSearchTimer)
    addTeacherSearchTimer = null
  }
  addTeacherSearchLoading.value = false
  addTeacherSearchRows.value = []
}

function resetAssignTeacherState() {
  cancelAssignTeacherSearch()
  assignClassSubjectId.value = ''
  assignSubjectName.value = ''
  assignTeacherId.value = ''
  assignTeacherKeyword.value = ''
}

function resetAddTeacherState() {
  cancelAddTeacherSearch()
  newTeacherId.value = ''
  addTeacherKeyword.value = ''
}

async function doSearchAssignTeachers(keyword = assignTeacherKeyword.value) {
  if (assignTeacherSearchTimer) clearTimeout(assignTeacherSearchTimer)
  const requestId = ++assignTeacherSearchRequestId
  assignTeacherSearchLoading.value = true
  assignTeacherSearchTimer = setTimeout(async () => {
    try {
      const result = rows(await call('searchTeachers', keyword.trim()))
      if (requestId !== assignTeacherSearchRequestId || !assignModalVisible.value) return
      assignTeacherSearchRows.value = result
    } catch {
      if (requestId !== assignTeacherSearchRequestId || !assignModalVisible.value) return
      assignTeacherSearchRows.value = []
    } finally {
      if (requestId === assignTeacherSearchRequestId) {
        assignTeacherSearchLoading.value = false
        assignTeacherSearchTimer = null
      }
    }
  }, 300)
}

function onAssignTeacherInput() {
  if (assignTeacherId.value) assignTeacherId.value = ''
  doSearchAssignTeachers()
}

function selectAssignTeacher(teacher: AnyRow) {
  cancelAssignTeacherSearch()
  assignTeacherId.value = teacher.id
  assignTeacherKeyword.value = teacher.realName || teacher.name || teacher.loginName || ''
}

function clearAssignTeacherSelection() {
  cancelAssignTeacherSearch()
  assignTeacherId.value = ''
  assignTeacherKeyword.value = ''
  doSearchAssignTeachers()
}

async function doSearchAddTeachers(keyword = addTeacherKeyword.value) {
  if (addTeacherSearchTimer) clearTimeout(addTeacherSearchTimer)
  const requestId = ++addTeacherSearchRequestId
  addTeacherSearchLoading.value = true
  addTeacherSearchTimer = setTimeout(async () => {
    try {
      const result = rows(await call('searchTeachers', keyword.trim()))
      if (requestId !== addTeacherSearchRequestId || !courseModalVisible.value) return
      addTeacherSearchRows.value = result
    } catch {
      if (requestId !== addTeacherSearchRequestId || !courseModalVisible.value) return
      addTeacherSearchRows.value = []
    } finally {
      if (requestId === addTeacherSearchRequestId) {
        addTeacherSearchLoading.value = false
        addTeacherSearchTimer = null
      }
    }
  }, 300)
}

function onAddTeacherInput() {
  if (newTeacherId.value) newTeacherId.value = ''
  doSearchAddTeachers()
}

function selectAddTeacher(teacher: AnyRow) {
  cancelAddTeacherSearch()
  newTeacherId.value = teacher.id
  addTeacherKeyword.value = teacher.realName || teacher.name || teacher.loginName || ''
}

function clearAddTeacherSelection() {
  cancelAddTeacherSearch()
  newTeacherId.value = ''
  addTeacherKeyword.value = ''
  doSearchAddTeachers()
}

// --- Assign teacher ---
function openAssignTeacher(cs: AnyRow) {
  cancelAssignTeacherSearch()
  assignClassSubjectId.value = cs.id
  assignSubjectName.value = cs.subjectName
  assignTeacherId.value = cs.teacherUserId || ''
  assignTeacherKeyword.value = cs.teacherName || ''
  assignTeacherSearchRows.value = []
  assignTeacherSearchLoading.value = false
  assignModalVisible.value = true
}

function closeAssignModal() {
  assignModalVisible.value = false
  resetAssignTeacherState()
}

async function saveAssignTeacher() {
  if (!assignTeacherId.value) {
    showError('请选择任课老师')
    return
  }
  try {
    await call('updateClassSubjectTeacher', assignClassSubjectId.value, Number(assignTeacherId.value))
    closeAssignModal()
    await loadClassSubjects()
  } catch (e: any) {
    showError(e?.message || '设置任课老师失败')
  }
}

// --- Init ---
async function loadClassFilterOptions() {
  try {
    filterOptions.value = payload(await call('listClassFilterOptions')) || {}
  } catch {
    filterOptions.value = {}
  }
}

onMounted(async () => {
  await loadClassFilterOptions()
  await search(false)
})
</script>

<style scoped>
/* Class roster: aligned with the system's slate surfaces and teal primary actions. */
.class-roster-page {
  --roster-ink: #0f172a;
  --roster-ink-soft: #334155;
  --roster-paper: #f8fafc;
  --roster-paper-deep: #f1f5f9;
  --roster-line: #e2e8f0;
  --roster-line-strong: #cbd5e1;
  --roster-sage: #0d9488;
  --roster-moss: #0f766e;
  --roster-teal: #0f766e;
  --roster-teal-hover: #115e59;
  --roster-teal-soft: #ecfdf5;
  --roster-coral: #b91c1c;
  --roster-error-soft: #fef2f2;
  --roster-error-line: #fecaca;
  --roster-gold: #92400e;
  --roster-warning-soft: #fef3c7;
  --roster-warning-line: #fcd34d;
  --roster-muted: #64748b;
  --roster-surface: rgba(255, 255, 255, .78);
  --roster-surface-strong: rgba(255, 255, 255, .96);
  background: transparent;
  border-radius: 18px;
  color: var(--roster-ink);
  display: grid;
  font-family: Inter, "Noto Sans SC", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  gap: 22px;
  isolation: isolate;
  max-width: 1380px;
  overflow: hidden;
  padding: clamp(20px, 3vw, 34px);
  position: relative;
}

.class-roster-page::before {
  content: none;
}

.class-roster-page > * {
  position: relative;
  z-index: 1;
}

.class-roster-masthead {
  border-bottom: 1px solid var(--roster-line);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: end;
  gap: 20px;
  padding: 8px 0 20px;
}

.class-roster-masthead__copy {
  max-width: 760px;
}

.roster-kicker {
  color: var(--roster-teal);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .14em;
  line-height: 1.2;
  margin: 0;
  text-transform: uppercase;
}

.class-roster-masthead h1 {
  color: var(--roster-ink);
  font-size: clamp(28px, 3vw, 40px);
  font-family: inherit;
  font-weight: 800;
  letter-spacing: -.025em;
  line-height: 1.08;
  margin: 10px 0 0;
}

.roster-lead {
  color: var(--roster-ink-soft);
  font-size: 14px;
  line-height: 1.7;
  margin: 12px 0 0;
}

.class-roster-signpost {
  border-top: 3px solid var(--roster-gold);
  display: grid;
  gap: 3px;
  min-width: 132px;
  padding-top: 9px;
}

.class-roster-signpost__value {
  color: var(--roster-ink);
  font-size: 36px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: -.04em;
  line-height: 1;
}

.class-roster-signpost__label,
.roster-metric__note {
  color: var(--roster-muted);
  font-size: 11px;
  letter-spacing: .04em;
}

.class-roster-create {
  align-self: end;
  white-space: nowrap;
}

.button-icon {
  fill: none;
  height: 16px;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  width: 16px;
}

.button .button-icon {
  flex: 0 0 auto;
}

.roster-button-spinner {
  animation: roster-spin .7s linear infinite;
  border: 2px solid rgba(255, 255, 255, .42);
  border-radius: 50%;
  border-top-color: #fff;
  flex: 0 0 16px;
  height: 16px;
  width: 16px;
}

@keyframes roster-spin {
  to { transform: rotate(360deg); }
}

.class-roster-create .button-icon,
.roster-card__actions .button-icon,
.roster-query-actions .button-icon,
.roster-empty .button-icon {
  margin-left: 3px;
}

.class-readonly-note {
  align-items: flex-start;
  background: var(--roster-paper-deep);
  border-left: 3px solid var(--roster-teal);
  border-radius: 12px;
  display: flex;
  gap: 12px;
  padding: 13px 16px;
}

.class-readonly-note__mark {
  align-items: center;
  background: var(--roster-teal);
  border-radius: 50%;
  color: #fff;
  display: inline-flex;
  flex: 0 0 18px;
  height: 18px;
  justify-content: center;
  margin-top: 1px;
}

.class-readonly-note__mark svg {
  fill: none;
  height: 14px;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  width: 14px;
}

.class-readonly-note strong {
  color: var(--roster-ink-soft);
  display: block;
  font-size: 13px;
}

.class-readonly-note p {
  color: var(--roster-muted);
  font-size: 12px;
  line-height: 1.5;
  margin: 3px 0 0;
}

.roster-metrics {
  border-bottom: 1px solid var(--roster-line);
  border-top: 1px solid var(--roster-line);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.roster-metric {
  align-items: center;
  border-right: 1px solid var(--roster-line);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  min-height: 76px;
  padding: 12px 16px;
}

.roster-metric:last-child {
  border-right: 0;
}

.roster-metric__index {
  align-self: start;
  color: var(--roster-gold);
  font-family: inherit;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .06em;
}

.roster-metric__label {
  color: var(--roster-ink-soft);
  display: block;
  font-size: 12px;
}

.roster-metric strong {
  color: var(--roster-ink);
  display: block;
  font-size: 28px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.04em;
  line-height: 1.05;
  margin-top: 4px;
}

.roster-metric__note {
  align-self: end;
  grid-column: 2;
  margin-top: -4px;
}

.roster-index-panel {
  background: var(--roster-surface);
  border: 1px solid var(--roster-line);
  border-top: 4px solid var(--roster-ink);
  border-radius: 16px;
  padding: 18px 20px 20px;
}

.roster-section-heading,
.roster-results-heading {
  align-items: flex-start;
  display: flex;
  gap: 20px;
  justify-content: space-between;
}

.roster-section-heading__title {
  align-items: flex-start;
  display: flex;
  gap: 13px;
}

.roster-section-number {
  color: var(--roster-teal);
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.4;
}

.roster-section-heading h2,
.roster-results-heading h2 {
  color: var(--roster-ink);
  font-size: 21px;
  letter-spacing: -.025em;
  line-height: 1.2;
  margin: 6px 0 0;
}

.roster-section-heading__hint {
  color: var(--roster-muted);
  font-size: 12px;
  line-height: 1.55;
  margin: 14px 0 0;
  max-width: 310px;
  text-align: right;
}

.roster-query-form {
  align-items: end;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 14px;
  margin-top: 20px;
}

.roster-field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.roster-field > span {
  color: var(--roster-ink-soft);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
}

.roster-field select,
.roster-input,
.course-add-select {
  appearance: auto;
  background: var(--roster-surface-strong);
  border: 1px solid var(--roster-line-strong);
  border-radius: 16px;
  color: var(--roster-ink);
  min-height: 42px;
  outline: none;
  padding: 10px 12px;
  width: 100%;
}

.roster-field select:focus,
.roster-input:focus,
.course-add-select:focus,
.pagination-size-select:focus {
  border-color: var(--roster-moss);
  box-shadow: 0 0 0 3px rgba(20, 184, 166, .16);
  outline: none;
}

.roster-query-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.roster-filter-summary {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.roster-filter-summary__label {
  color: var(--roster-muted);
  font-size: 11px;
  margin-right: 2px;
}

.roster-filter-chip {
  background: var(--roster-teal-soft);
  border: 1px solid rgba(15, 118, 110, .24);
  border-radius: 999px;
  color: var(--roster-teal);
  font-size: 12px;
  font-weight: 700;
  padding: 5px 10px;
}

.class-roster-page .button {
  align-items: center;
  border-radius: 16px;
  display: inline-flex;
  gap: 6px;
  justify-content: center;
  min-height: 42px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, .06);
  transition: background-color .16s, border-color .16s, color .16s, transform .16s;
}

.class-roster-page .button.sm {
  min-height: 38px;
}

.class-roster-page .button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.class-roster-page .button.primary {
  background: var(--roster-teal);
  border-color: var(--roster-teal);
  color: #fff;
}

.class-roster-page .button.primary:hover:not(:disabled) {
  background: var(--roster-teal-hover);
  border-color: var(--roster-teal-hover);
}

.class-roster-page .button.ghost {
  background: var(--roster-paper);
  border-color: var(--roster-line-strong);
  color: var(--roster-ink-soft);
}

.class-roster-page .button.ghost:hover:not(:disabled) {
  background: var(--roster-surface-strong);
  border-color: var(--roster-moss);
  color: var(--roster-moss);
}

.class-roster-page .button.danger {
  color: var(--roster-coral);
}

.class-roster-page .button:focus-visible,
.class-roster-page input:focus-visible,
.class-roster-page select:focus-visible,
.class-editor-modal .button:focus-visible,
.course-workbench .button:focus-visible,
.assign-teacher-modal .button:focus-visible,
.error-modal .button:focus-visible,
.course-combo-chip:focus-within,
.teacher-search-item:focus-visible {
  outline: 3px solid rgba(20, 184, 166, .42);
  outline-offset: 2px;
}

.roster-results {
  display: grid;
  gap: 16px;
}

.roster-results-heading {
  align-items: end;
  border-bottom: 1px solid var(--roster-line);
  padding-bottom: 12px;
}

.roster-results-heading__count {
  color: var(--roster-ink);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  margin: 0;
}

.roster-results-heading__count span {
  color: var(--roster-muted);
  font-size: 12px;
  font-weight: 500;
  margin-left: 3px;
}

.roster-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.roster-card {
  background: var(--roster-surface-strong);
  border: 1px solid var(--roster-line);
  border-top: 2px solid var(--roster-teal);
  border-radius: 16px;
  display: grid;
  gap: 15px;
  min-width: 0;
  padding: 18px;
  transition: border-color .16s, transform .16s, box-shadow .16s;
}

.roster-card:hover {
  border-color: rgba(15, 118, 110, .42);
  border-top-color: var(--roster-teal);
  box-shadow: 0 14px 28px rgba(15, 23, 42, .09);
  transform: translateY(-2px);
}

.roster-card--inactive {
  border-top-color: var(--roster-line-strong);
  opacity: .68;
}

.roster-card--inactive:hover {
  border-color: var(--roster-line);
  border-top-color: var(--roster-line-strong);
  box-shadow: none;
  transform: none;
}

.roster-card__head {
  align-items: flex-start;
  display: grid;
  gap: 12px;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.roster-card__number {
  color: var(--roster-gold);
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .04em;
  line-height: 1.45;
}

.roster-card__identity {
  min-width: 0;
}

.roster-card__title-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.roster-card h3 {
  color: var(--roster-ink);
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -.025em;
  line-height: 1.2;
  margin: 0;
  overflow-wrap: anywhere;
}

.roster-card__badge {
  border: 1px solid;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .04em;
  line-height: 1.5;
  padding: 2px 6px;
  white-space: nowrap;
}

.roster-card__badge--key {
  background: var(--roster-warning-soft);
  border-color: var(--roster-warning-line);
  color: #92400e;
}

.roster-card__badge--normal {
  background: var(--roster-paper-deep);
  border-color: var(--roster-line);
  color: var(--roster-muted);
}

.roster-card__code {
  color: var(--roster-muted);
  font-family: inherit;
  font-size: 11px;
  margin: 7px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.roster-card__combo {
  border-left: 1px solid var(--roster-line);
  color: var(--roster-teal);
  font-family: inherit;
  font-weight: 800;
  margin-left: 7px;
  padding-left: 7px;
}

.roster-card__combo--first {
  border-left: 0;
  margin-left: 0;
  padding-left: 0;
}

.roster-card__status-dot {
  border-radius: 50%;
  height: 9px;
  margin-top: 4px;
  width: 9px;
}

.roster-card__status-dot--active {
  background: var(--roster-teal);
  box-shadow: 0 0 0 3px rgba(15, 118, 110, .14);
}

.roster-card__status-dot--inactive {
  background: #94a3b8;
}

.roster-card__details {
  border-bottom: 1px solid var(--roster-line);
  border-top: 1px solid var(--roster-line);
  display: grid;
  gap: 17px;
  padding: 14px 0;
}

.roster-card__facts {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}

.roster-card__facts div {
  border-right: 1px solid var(--roster-line);
  min-width: 0;
  padding-right: 10px;
}

.roster-card__facts div:last-child {
  border-right: 0;
}

.roster-card__facts dt {
  color: var(--roster-muted);
  font-size: 11px;
  margin-bottom: 4px;
}

.roster-card__facts dd {
  color: var(--roster-ink-soft);
  font-size: 12px;
  font-weight: 700;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.roster-card__teacher {
  align-items: center;
  display: flex;
  gap: 10px;
}

.roster-card__teacher-avatar {
  align-items: center;
  background: var(--roster-sage);
  color: #fff;
  display: inline-flex;
  flex: 0 0 34px;
  font-size: 15px;
  font-weight: 800;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.roster-card__teacher-label {
  color: var(--roster-muted);
  display: block;
  font-size: 10px;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.roster-card__teacher strong {
  color: var(--roster-ink);
  display: block;
  font-size: 13px;
  margin-top: 2px;
}

.roster-card__actions {
  align-items: center;
  display: flex;
  gap: 7px;
}

.roster-card__actions .button:first-child {
  flex: 1;
  justify-content: center;
}

.roster-card__actions .button {
  align-items: center;
  display: inline-flex;
  justify-content: center;
  white-space: nowrap;
}

.roster-empty {
  align-items: center;
  background: var(--roster-surface);
  border: 1px solid var(--roster-line);
  border-radius: 16px;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 32px 24px;
}

.roster-error {
  align-items: center;
  background: var(--roster-error-soft);
  border: 1px solid var(--roster-error-line);
  border-radius: 16px;
  display: flex;
  gap: 14px;
  justify-content: space-between;
  padding: 20px 22px;
}

.roster-error__mark {
  align-items: center;
  background: var(--roster-coral);
  border-radius: 50%;
  color: #fff;
  display: inline-flex;
  flex: 0 0 28px;
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: 800;
  height: 28px;
  justify-content: center;
  width: 28px;
}

.roster-error h3 {
  color: #991b1b;
  font-size: 15px;
  margin: 0;
}

.roster-error p {
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.5;
  margin: 4px 0 0;
}

.roster-empty__index {
  color: var(--roster-line-strong);
  font-family: inherit;
  font-size: 24px;
  font-weight: 800;
}

.roster-empty h3 {
  color: var(--roster-ink);
  font-size: 16px;
  margin: 0;
}

.roster-empty p {
  color: var(--roster-muted);
  font-size: 12px;
  margin: 5px 0 0;
}

.roster-pagination {
  align-items: center;
  border-bottom: 1px solid var(--roster-line);
  border-top: 1px solid var(--roster-line);
  display: flex;
  gap: 18px;
  justify-content: space-between;
  padding: 12px 0;
}

.roster-pagination__summary,
.roster-pagination__summary label,
.roster-pagination__buttons {
  align-items: center;
  display: flex;
  gap: 8px;
}

.roster-pagination__summary {
  color: var(--roster-muted);
  font-size: 12px;
}

.roster-pagination__divider {
  color: var(--roster-line);
}

.roster-pagination__summary label {
  margin-left: 8px;
}

.roster-pagination .pagination-size-select {
  background: var(--roster-surface-strong);
  border: 1px solid var(--roster-line);
  border-radius: 12px;
  color: var(--roster-ink-soft);
  padding: 4px 6px;
  width: auto;
}

.roster-pagination__buttons .button {
  min-width: 34px;
}

.roster-card--skeleton {
  border-top-color: var(--roster-line);
  gap: 16px;
  height: 228px;
}

.skeleton-line {
  animation: roster-skeleton-shimmer 1.5s ease-in-out infinite;
  background: linear-gradient(90deg, #e2e8f0 25%, #f8fafc 50%, #e2e8f0 75%) 0 0 / 200% 100%;
  border-radius: 8px;
  display: block;
  height: 14px;
}

.skeleton-name {
  height: 23px;
  width: 55%;
}

.skeleton-meta {
  width: 78%;
}

.skeleton-action {
  margin-top: auto;
  width: 42%;
}

@keyframes roster-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Class editor */
.class-editor-modal,
.course-workbench,
.assign-teacher-modal,
.error-modal {
  --roster-ink: #0f172a;
  --roster-ink-soft: #334155;
  --roster-paper: #f8fafc;
  --roster-paper-deep: #f1f5f9;
  --roster-line: #e2e8f0;
  --roster-line-strong: #cbd5e1;
  --roster-sage: #0d9488;
  --roster-moss: #0f766e;
  --roster-teal: #0f766e;
  --roster-teal-hover: #115e59;
  --roster-teal-soft: #ecfdf5;
  --roster-coral: #b91c1c;
  --roster-error-soft: #fef2f2;
  --roster-error-line: #fecaca;
  --roster-gold: #92400e;
  --roster-warning-soft: #fef3c7;
  --roster-warning-line: #fcd34d;
  --roster-muted: #64748b;
  --roster-surface: rgba(255, 255, 255, .9);
  --roster-surface-strong: rgba(255, 255, 255, .98);
  background: var(--roster-surface-strong);
  border: 1px solid var(--roster-line);
  border-radius: 24px;
  color: var(--roster-ink);
  padding: 0;
}

.class-editor-modal .button,
.course-workbench .button,
.assign-teacher-modal .button,
.error-modal .button {
  align-items: center;
  border-radius: 16px;
  display: inline-flex;
  gap: 6px;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(15, 23, 42, .06);
}

.class-editor-modal .button.primary,
.course-workbench .button.primary,
.assign-teacher-modal .button.primary,
.error-modal .button.primary {
  background: var(--roster-teal);
  border-color: var(--roster-teal);
  color: #fff;
}

.class-editor-modal .button.primary:hover:not(:disabled),
.course-workbench .button.primary:hover:not(:disabled),
.assign-teacher-modal .button.primary:hover:not(:disabled),
.error-modal .button.primary:hover:not(:disabled) {
  background: var(--roster-teal-hover);
  border-color: var(--roster-teal-hover);
}

.class-editor-modal .button.ghost,
.course-workbench .button.ghost,
.assign-teacher-modal .button.ghost,
.error-modal .button.ghost {
  background: var(--roster-paper);
  border-color: var(--roster-line-strong);
  color: var(--roster-ink-soft);
}

.class-editor-modal .button.ghost:hover:not(:disabled),
.course-workbench .button.ghost:hover:not(:disabled),
.assign-teacher-modal .button.ghost:hover:not(:disabled),
.error-modal .button.ghost:hover:not(:disabled) {
  background: var(--roster-surface-strong);
  border-color: var(--roster-teal);
  color: var(--roster-teal);
}

.class-editor-modal {
  width: min(820px, 100%);
}

.class-modal-head,
.course-modal-head {
  align-items: flex-start;
  border-bottom: 1px solid var(--roster-line);
  display: flex;
  gap: 18px;
  justify-content: space-between;
  padding: 26px 30px 22px;
}

.class-modal-head h2,
.course-modal-head h2 {
  color: var(--roster-ink);
  font-size: 25px;
  letter-spacing: -.035em;
  line-height: 1.15;
  margin: 7px 0 0;
}

.class-modal-head p:last-child,
.course-modal-head p:last-child {
  color: var(--roster-muted);
  font-size: 12px;
  line-height: 1.5;
  margin: 7px 0 0;
}

.modal-close {
  padding: 8px !important;
}

.class-editor-form {
  display: grid;
  gap: 20px;
  padding: 24px 30px 28px;
}

.class-editor-form__error {
  background: var(--roster-error-soft);
  border: 1px solid var(--roster-error-line);
  border-radius: 16px;
  color: var(--roster-coral);
  font-size: 13px;
  margin: 0;
}

.class-editor-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.course-combo-section {
  background: var(--roster-paper);
  border: 1px solid var(--roster-line);
  border-left: 3px solid var(--roster-teal);
  border-radius: 20px;
  padding: 18px 20px;
}

.course-combo-section__head {
  align-items: flex-start;
  border-bottom: 1px solid var(--roster-line);
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  padding-bottom: 13px;
}

.course-combo-section h3 {
  color: var(--roster-ink);
  font-size: 16px;
  margin: 5px 0 0;
}

.course-combo-section__count {
  color: var(--roster-muted);
  font-size: 11px;
}

.course-combo-step {
  align-items: center;
  border-bottom: 1px solid var(--roster-line);
  display: grid;
  gap: 14px;
  grid-template-columns: 150px minmax(0, 1fr);
  padding: 13px 0;
}

.course-combo-step:last-of-type {
  border-bottom: 0;
}

.course-combo-step__heading {
  align-items: center;
  display: flex;
  gap: 8px;
}

.course-combo-step__heading > span {
  align-items: center;
  background: var(--roster-moss);
  border-radius: 50%;
  color: #fff;
  display: inline-flex;
  font-family: inherit;
  font-size: 10px;
  height: 20px;
  justify-content: center;
  width: 20px;
}

.course-combo-step__heading strong {
  color: var(--roster-ink-soft);
  font-size: 12px;
}

.course-combo-step__heading small {
  color: var(--roster-teal);
  font-size: 11px;
  margin-left: auto;
}

.course-combo-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.course-combo-chip {
  background: #fff;
  border: 1px solid var(--roster-line-strong);
  border-radius: 16px;
  color: var(--roster-ink-soft);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  padding: 7px 13px;
  user-select: none;
}

.course-combo-chip input {
  opacity: 0;
  position: absolute;
}

.course-combo-chip:hover {
  border-color: var(--roster-teal);
  color: var(--roster-teal);
}

.course-combo-chip--active {
  background: var(--roster-teal-soft);
  border-color: var(--roster-teal);
  color: var(--roster-teal);
}

.course-combo-chip--disabled {
  cursor: not-allowed;
  opacity: .45;
}

.course-combo-preview {
  align-items: center;
  background: var(--roster-paper-deep);
  border: 1px dashed var(--roster-line-strong);
  border-radius: 16px;
  display: flex;
  gap: 12px;
  margin-top: 10px;
  padding: 10px 12px;
}

.course-combo-preview span {
  color: var(--roster-muted);
  font-size: 11px;
}

.course-combo-preview strong {
  color: var(--roster-ink);
  font-size: 13px;
}

.modal-actions {
  display: flex;
  gap: 9px;
  justify-content: flex-end;
}

/* Course management workbench */
.course-workbench {
  max-width: 680px;
  width: 100%;
}

.course-modal-head {
  background: var(--roster-ink);
  border-bottom-color: var(--roster-ink);
  border-radius: 23px 23px 0 0;
}

.course-modal-head h2 {
  color: #fff;
}

.course-modal-head .roster-kicker {
  color: #5eead4;
}

.course-modal-head p:last-child {
  color: #cbd5e1;
}

.course-modal-head .button.ghost {
  background: rgba(255, 255, 255, .08);
  border-color: #ffffff4d;
  color: #fff;
}

.course-modal-head .button.ghost:hover:not(:disabled) {
  background: #ffffff12;
  border-color: #ffffff80;
  color: #fff;
}

.course-workbench > .roster-field,
.course-workbench > .course-term-field {
  margin: 20px 30px 0;
}

.course-term-field {
  max-width: 320px;
}

.course-workbench > template {
  display: contents;
}

.course-workbench > .course-combo-info-bar,
.course-workbench > .course-combo-mismatch,
.course-workbench > .course-list,
.course-workbench > .course-list-empty,
.course-workbench > .course-add-panel,
.course-workbench > .course-select-term-hint {
  margin-left: 30px;
  margin-right: 30px;
}

.course-combo-info-bar {
  align-items: center;
  background: var(--roster-teal-soft);
  border: 1px solid rgba(15, 118, 110, .24);
  border-radius: 16px;
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
  margin-top: 18px;
  padding: 10px 12px;
}

.course-context-label {
  color: var(--roster-muted);
  font-size: 11px;
}

.course-combo-info-bar strong {
  color: var(--roster-teal);
  font-size: 13px;
}

.course-combo-mismatch {
  background: var(--roster-warning-soft);
  border: 1px solid var(--roster-warning-line);
  border-radius: 16px;
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 13px;
  padding: 10px 12px;
}

.course-list {
  display: grid;
  gap: 7px;
  margin-top: 14px;
}

.course-item-row {
  align-items: center;
  background: var(--roster-paper);
  border-bottom: 1px solid var(--roster-line);
  border-radius: 16px;
  display: grid;
  gap: 12px;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  padding: 11px 0;
}

.course-item-index {
  color: var(--roster-gold);
  font-family: inherit;
  font-size: 11px;
  font-weight: 800;
}

.course-item-info {
  min-width: 0;
}

.course-item-info strong {
  color: var(--roster-ink);
  display: block;
  font-size: 14px;
}

.course-item-info span {
  color: var(--roster-teal);
  display: block;
  font-size: 11px;
  margin-top: 4px;
}

.course-item-info .muted-block {
  color: var(--roster-muted);
}

.course-item-actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}

.course-list-empty,
.course-select-term-hint {
  color: var(--roster-muted);
  font-size: 12px;
  padding: 18px 0;
  text-align: center;
}

.course-loading {
  color: var(--roster-muted);
  font-size: 13px;
  padding: 45px 20px;
  text-align: center;
}

.course-add-panel {
  background: var(--roster-paper);
  border: 1px solid var(--roster-line);
  border-top: 2px solid var(--roster-teal);
  border-radius: 20px;
  margin-bottom: 28px;
  margin-top: 20px;
  padding: 14px;
}

.course-add-panel__heading {
  align-items: baseline;
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.course-add-panel__heading strong {
  color: var(--roster-ink);
  font-size: 13px;
}

.course-add-row {
  align-items: flex-start;
  display: flex;
  gap: 8px;
}

.course-add-select {
  flex: 0 1 170px;
  min-width: 135px;
}

.teacher-search--inline {
  min-width: 180px;
}

.course-add-button {
  flex-shrink: 0;
}

.course-add-hint {
  color: var(--roster-muted);
  font-size: 11px;
  margin: 8px 0 0;
}

/* Search dropdowns are reused by both teacher assignment flows. */
.teacher-search input {
  color: var(--roster-ink);
}

.teacher-search-loading,
.teacher-search-list {
  background: var(--roster-surface-strong);
  border: 1px solid var(--roster-line);
  border-radius: 16px;
  box-shadow: 0 12px 25px rgba(15, 23, 42, .12);
}

.teacher-search-loading {
  color: var(--roster-muted);
  padding: 9px 11px;
}

.teacher-search-list {
  gap: 2px;
  padding: 4px;
}

.teacher-search-item {
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  gap: 8px;
  padding: 9px 10px;
}

.teacher-search-item:hover {
  background: var(--roster-teal-soft);
}

.teacher-search-item strong {
  color: var(--roster-ink);
  font-size: 13px;
}

.teacher-search-item span {
  color: var(--roster-muted);
  font-size: 11px;
}

.teacher-search-empty {
  color: var(--roster-muted);
  padding: 10px;
  text-align: center;
}

.teacher-search-selected {
  align-items: center;
  background: var(--roster-teal-soft);
  border: 1px solid rgba(15, 118, 110, .24);
  border-radius: 16px;
  display: flex;
  gap: 8px;
  margin-top: 5px;
  padding: 7px 9px;
}

.teacher-search-selected-name {
  color: var(--roster-teal);
  font-size: 12px;
  font-weight: 700;
}

.teacher-search-selected small {
  color: var(--roster-muted);
  font-size: 10px;
}

.teacher-search-clear {
  background: transparent;
  border: 0;
  color: var(--roster-muted);
  cursor: pointer;
  line-height: 1;
  margin-left: auto;
  padding: 1px 4px;
}

.teacher-search-clear .button-icon {
  height: 15px;
  width: 15px;
}

.teacher-search-clear:hover {
  color: var(--roster-coral);
}

.assign-teacher-modal {
  max-width: 460px;
  width: 100%;
}

.assign-teacher-body {
  padding: 20px 30px 0;
}

.assign-teacher-modal > .modal-actions,
.error-modal > .modal-actions {
  padding: 20px 30px 26px;
}

.error-modal {
  max-width: 450px;
  width: 100%;
}

.error-modal__message {
  border-radius: 16px;
  margin: 20px 30px 0;
}

@media (max-width: 1050px) {
  .class-roster-masthead {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .class-roster-create {
    grid-column: 2;
    grid-row: 1;
  }

  .class-roster-signpost {
    grid-column: 2;
    grid-row: 2;
  }

  .roster-metric {
    padding-left: 12px;
    padding-right: 12px;
  }
}

@media (max-width: 760px) {
  .class-roster-page {
    gap: 20px;
    padding-left: 16px;
    padding-right: 16px;
  }

  .class-roster-masthead {
    align-items: start;
    grid-template-columns: 1fr auto;
    padding-bottom: 18px;
  }

  .class-roster-masthead__copy {
    grid-column: 1 / -1;
  }

  .class-roster-masthead h1 {
    font-size: 32px;
  }

  .class-roster-signpost {
    grid-column: 1;
    grid-row: auto;
  }

  .class-roster-create {
    align-self: start;
    grid-column: 2;
    grid-row: auto;
  }

  .roster-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .roster-metric:nth-child(2) {
    border-right: 0;
  }

  .roster-metric:nth-child(-n + 2) {
    border-bottom: 1px solid var(--roster-line);
  }

  .roster-section-heading,
  .roster-results-heading,
  .roster-empty,
  .roster-pagination {
    align-items: flex-start;
    flex-direction: column;
  }

  .roster-section-heading__hint {
    margin: 0;
    max-width: none;
    text-align: left;
  }

  .roster-query-form,
  .class-editor-grid {
    grid-template-columns: 1fr;
  }

  .roster-query-actions {
    justify-content: stretch;
  }

  .roster-query-actions .button {
    flex: 1;
  }

  .class-roster-page .button.sm {
    min-height: 42px;
  }

  .roster-grid {
    grid-template-columns: 1fr;
  }

  .roster-empty .button {
    width: 100%;
  }

  .roster-error {
    align-items: stretch;
    flex-direction: column;
  }

  .roster-error .button {
    width: 100%;
  }

  .roster-pagination__summary,
  .roster-pagination__buttons {
    flex-wrap: wrap;
  }

  .roster-pagination__buttons .button {
    flex: 1;
  }

  .class-modal-head,
  .course-modal-head {
    padding: 22px 20px 18px;
  }

  .class-editor-form {
    padding: 20px;
  }

  .course-combo-step {
    align-items: start;
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .course-combo-step__heading {
    max-width: 250px;
  }

  .course-workbench > .roster-field,
  .course-workbench > .course-term-field,
  .course-workbench > .course-combo-info-bar,
  .course-workbench > .course-combo-mismatch,
  .course-workbench > .course-list,
  .course-workbench > .course-list-empty,
  .course-workbench > .course-add-panel,
  .course-workbench > .course-select-term-hint {
    margin-left: 20px;
    margin-right: 20px;
  }

  .course-add-row {
    flex-wrap: wrap;
  }

  .course-add-select,
  .teacher-search--inline {
    flex: 1 1 100%;
  }

  .course-add-button {
    margin-left: auto;
  }

  .course-item-row {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .course-item-actions {
    grid-column: 2;
  }

  .assign-teacher-body {
    padding: 20px 20px 0;
  }

  .assign-teacher-modal > .modal-actions,
  .error-modal > .modal-actions {
    padding-left: 20px;
    padding-right: 20px;
  }

  .error-modal__message {
    margin-left: 20px;
    margin-right: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .class-roster-page *,
  .class-roster-page *::before,
  .class-roster-page *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}
</style>
