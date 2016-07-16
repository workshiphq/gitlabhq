module Ci
  class CreatePipelineService < BaseService
    attr_reader :pipeline
    attr_reader :yaml_errors
    attr_reader :trigger_request

    def execute(skip_ci: true, save_yaml_error: true, trigger_request: nil)
      @pipeline = project.pipelines.new(
        ref: ref_name,
        sha: real_sha,
        before_sha: before_sha,
        tag: tag?
      )
      @trigger_request = trigger_request

      unless project.builds_enabled?
        return error('Pipeline is disabled')
      end

      unless can?(current_user, :create_pipeline, project)
        return error('Insufficient permissions to create a new pipeline')
      end

      unless ref_names.include?(ref_name)
        return error('Reference not found')
      end

      unless commit
        return error('Commit not found')
      end

      if skip_ci && config_processor.skip_ci?
        return error('Creation of pipeline is skipped')
      end

      unless config_processor
        pipeline.yaml_errors = yaml_errors || 'Missing .gitlab-ci.yml file'
        pipeline.save if save_yaml_error
        return error(pipeline.yaml_errors)
      end

      unless builds_attributes.any?
        return error('No builds for this pipeline.')
      end

      pipeline.save
      create_builds
      pipeline.process!
      pipeline
    end

    private

    def create_builds
      builds_attributes.map do |build_attributes|
        build_attributes = build_attributes.merge(
          pipeline: pipeline,
          project: pipeline.project,
          ref: pipeline.ref,
          tag: pipeline.tag,
          trigger_request: trigger_request,
          user: current_user,
        )
        pipeline.builds.create(build_attributes)
      end
    end

    def builds_attributes
      config_processor.builds_for_ref(ref, tag?, trigger_request).sort_by { |build| build[:stage_idx] }
    end

    def ref_names
      @ref_names ||= project.repository.ref_names
    end

    def commit
      @commit ||= project.commit(sha || ref)
    end

    def real_sha
      commit.try(:id)
    end

    def before_sha
      params[:checkout_sha] || params[:before] || Gitlab::Git::BLANK_SHA
    end

    def sha
      params[:checkout_sha] || params[:after]
    end

    def ref
      params[:ref]
    end

    def tag?
      Gitlab::Git.tag_ref?(ref)
    end

    def ref_name
      Gitlab::Git.ref_name(ref)
    end

    def valid_sha?
      sha != Gitlab::Git::BLANK_SHA
    end

    def error(message)
      pipeline.errors.add(:base, message)
      return pipeline
    end

    def config_processor
      return nil unless pipeline.ci_yaml_file
      return @config_processor if defined?(@config_processor)

      @config_processor ||= begin
        Ci::GitlabCiYamlProcessor.new(pipeline.ci_yaml_file, project.path_with_namespace)
      rescue Ci::GitlabCiYamlProcessor::ValidationError, Psych::SyntaxError => e
        self.yaml_errors = e.message
        nil
      rescue
        self.yaml_errors = 'Undefined error'
        nil
      end
    end
  end
end
